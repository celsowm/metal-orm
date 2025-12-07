import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../../orm/db-executor.js';
import { SelectQueryBuilder } from '../../../query-builder/select.js';
import { defineTable } from '../../../schema/table.js';
import { col } from '../../../schema/column.js';
import { eq, and } from '../../../core/ast/expression.js';
import { PostgresDialect } from '../../dialect/postgres/index.js';

const informationSchema = {
    columns: defineTable('information_schema.columns', {
        table_schema: col.varchar(255),
        table_name: col.varchar(255),
        column_name: col.varchar(255),
        data_type: col.varchar(255),
        is_nullable: col.varchar(255),
        column_default: col.varchar(255),
    }),
    table_constraints: defineTable('information_schema.table_constraints', {
        table_schema: col.string(),
        table_name: col.string(),
        constraint_name: col.string(),
        constraint_type: col.string(),
    }),
    key_column_usage: defineTable('information_schema.key_column_usage', {
        table_schema: col.string(),
        table_name: col.string(),
        column_name: col.string(),
        constraint_name: col.string(),
    }),
    constraint_column_usage: defineTable('information_schema.constraint_column_usage', {
        table_schema: col.string(),
        table_name: col.string(),
        column_name: col.string(),
        constraint_name: col.string(),
    }),
    referential_constraints: defineTable('information_schema.referential_constraints', {
        constraint_name: col.string(),
        constraint_schema: col.string(),
        update_rule: col.string(),
        delete_rule: col.string(),
    }),
};

const pg = {
    index: defineTable('pg_index', {
        indrelid: col.string(),
        indisprimary: col.boolean(),
        indkey: col.string(),
    }),
    class: defineTable('pg_class', {
        oid: col.string(),
        relname: col.string(),
        relnamespace: col.string(),
    }),
    namespace: defineTable('pg_namespace', {
        oid: col.string(),
        nspname: col.string(),
    }),
    attribute: defineTable('pg_attribute', {
        attrelid: col.string(),
        attnum: col.string(),
        attname: col.string(),
    }),
};


export const postgresIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema || 'public';
    const tables: DatabaseTable[] = [];
    const dialect = new PostgresDialect();

    const columnRows = await new SelectQueryBuilder(informationSchema.columns)
        .select({
            table_schema: informationSchema.columns.columns.table_schema,
            table_name: informationSchema.columns.columns.table_name,
            column_name: informationSchema.columns.columns.column_name,
            data_type: informationSchema.columns.columns.data_type,
            is_nullable: informationSchema.columns.columns.is_nullable,
            column_default: informationSchema.columns.columns.column_default,
        })
        .where(eq(informationSchema.columns.columns.table_schema, schema))
        .orderBy(informationSchema.columns.columns.table_name)
        .orderBy(informationSchema.columns.columns.column_name)
        .execute(executor, dialect);

    const pkRows = await new SelectQueryBuilder(pg.index)
        .select({
            table_schema: pg.namespace.columns.nspname,
            table_name: pg.class.columns.relname,
            pk_columns: pg.attribute.columns.attname,
        })
        .join(pg.class, eq(pg.class.columns.oid, pg.index.columns.indrelid))
        .join(pg.namespace, eq(pg.namespace.columns.oid, pg.class.columns.relnamespace))
        .join(pg.attribute, and(
            eq(pg.attribute.columns.attrelid, pg.class.columns.oid),
            eq(pg.attribute.columns.attnum, pg.index.columns.indkey)
        ))
        .where(and(
            eq(pg.index.columns.indisprimary, true),
            eq(pg.namespace.columns.nspname, schema)
        ))
        .groupBy(pg.namespace.columns.nspname)
        .groupBy(pg.class.columns.relname)
        .execute(executor, dialect);

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      pkMap.set(`${r.table_schema}.${r.table_name}`, r.pk_columns || []);
    });

    const fkRows = await new SelectQueryBuilder(informationSchema.table_constraints)
        .select({
            table_schema: informationSchema.table_constraints.columns.table_schema,
            table_name: informationSchema.table_constraints.columns.table_name,
            column_name: informationSchema.key_column_usage.columns.column_name,
            foreign_table_schema: informationSchema.constraint_column_usage.columns.table_schema,
            foreign_table_name: informationSchema.constraint_column_usage.columns.table_name,
            foreign_column_name: informationSchema.constraint_column_usage.columns.column_name,
        })
        .join(informationSchema.key_column_usage, and(
            eq(informationSchema.key_column_usage.columns.constraint_name, informationSchema.table_constraints.columns.constraint_name),
            eq(informationSchema.key_column_usage.columns.table_schema, informationSchema.table_constraints.columns.table_schema)
        ))
        .join(informationSchema.constraint_column_usage, and(
            eq(informationSchema.constraint_column_usage.columns.constraint_name, informationSchema.table_constraints.columns.constraint_name),
            eq(informationSchema.constraint_column_usage.columns.table_schema, informationSchema.table_constraints.columns.table_schema)
        ))
        .where(and(
            eq(informationSchema.table_constraints.columns.constraint_type, 'FOREIGN KEY'),
            eq(informationSchema.table_constraints.columns.table_schema, schema)
        ))
        .execute(executor, dialect);

    const fkMap = new Map<string, any[]>();
    fkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!fkMap.has(key)) {
        fkMap.set(key, []);
      }
      fkMap.get(key)!.push({
        column: r.column_name,
        referencesTable: `${r.foreign_table_schema}.${r.foreign_table_name}`,
        referencesColumn: r.foreign_column_name,
      });
    });

    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!shouldIncludeTable(r.table_name, options)) {
        return;
      }
      if (!tablesByKey.has(key)) {
        tablesByKey.set(key, {
          name: r.table_name,
          schema: r.table_schema,
          columns: [],
          primaryKey: pkMap.get(key) || [],
          indexes: [],
          foreignKeys: fkMap.get(key) || [],
        });
      }
      const cols = tablesByKey.get(key)!;
      const column: DatabaseColumn = {
        name: r.column_name,
        type: r.data_type,
        notNull: r.is_nullable === 'NO',
        default: r.column_default ?? undefined,
      };
      cols.columns.push(column);
    });

    // TODO: Refactor index introspection to use the query builder
    const indexRows = [];

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const idx: DatabaseIndex = {
        name: r.index_name,
        columns: (r.column_names || []).map((c: string) => ({ column: c })),
        unique: !!r.is_unique,
        where: r.predicate || undefined
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    tables.push(...tablesByKey.values());
    return { tables };
  }
};
