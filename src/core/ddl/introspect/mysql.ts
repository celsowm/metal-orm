import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../../orm/db-executor.js';
import { SelectQueryBuilder } from '../../../query-builder/select.js';
import { defineTable } from '../../../schema/table.js';
import { col } from '../../../schema/column.js';
import { eq, and, not, isNotNull } from '../../../core/ast/expression.js';
import { MySqlDialect } from '../../dialect/mysql/index.js';

const informationSchema = {
    columns: defineTable('information_schema.columns', {
        table_schema: col.varchar(255),
        table_name: col.varchar(255),
        column_name: col.varchar(255),
        data_type: col.varchar(255),
        is_nullable: col.varchar(255),
        column_default: col.varchar(255),
        extra: col.varchar(255),
    }),
    key_column_usage: defineTable('information_schema.key_column_usage', {
        table_schema: col.string(),
        table_name: col.string(),
        column_name: col.string(),
        constraint_name: col.string(),
        referenced_table_schema: col.string(),
        referenced_table_name: col.string(),
        referenced_column_name: col.string(),
    }),
    table_constraints: defineTable('information_schema.table_constraints', {
        table_schema: col.string(),
        table_name: col.string(),
        constraint_name: col.string(),
        constraint_type: col.string(),
    }),
    statistics: defineTable('information_schema.statistics', {
        table_schema: col.string(),
        table_name: col.string(),
        index_name: col.string(),
        non_unique: col.boolean(),
        column_name: col.string(),
    }),
};

export const mysqlIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const dialect = new MySqlDialect();

    const columnRows = await new SelectQueryBuilder(informationSchema.columns)
        .select({
            table_schema: informationSchema.columns.columns.table_schema,
            table_name: informationSchema.columns.columns.table_name,
            column_name: informationSchema.columns.columns.column_name,
            data_type: informationSchema.columns.columns.data_type,
            is_nullable: informationSchema.columns.columns.is_nullable,
            column_default: informationSchema.columns.columns.column_default,
            extra: informationSchema.columns.columns.extra,
        })
        .where(schema ? eq(informationSchema.columns.columns.table_schema, schema) : eq(informationSchema.columns.columns.table_schema, fn('database', [])))
        .orderBy(informationSchema.columns.columns.table_name)
        .orderBy(informationSchema.columns.columns.column_name)
        .execute(executor, dialect);

    const pkRows = await new SelectQueryBuilder(informationSchema.key_column_usage)
        .select({
            table_schema: informationSchema.key_column_usage.columns.table_schema,
            table_name: informationSchema.key_column_usage.columns.table_name,
            column_name: informationSchema.key_column_usage.columns.column_name,
        })
        .where(and(
            eq(informationSchema.key_column_usage.columns.constraint_name, 'PRIMARY'),
            schema ? eq(informationSchema.key_column_usage.columns.table_schema, schema) : eq(informationSchema.key_column_usage.columns.table_schema, fn('database', []))
        ))
        .orderBy(informationSchema.key_column_usage.columns.column_name)
        .execute(executor, dialect);

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const fkRows = await new SelectQueryBuilder(informationSchema.key_column_usage)
        .select({
            table_schema: informationSchema.key_column_usage.columns.table_schema,
            table_name: informationSchema.key_column_usage.columns.table_name,
            column_name: informationSchema.key_column_usage.columns.column_name,
            referenced_table_schema: informationSchema.key_column_usage.columns.referenced_table_schema,
            referenced_table_name: informationSchema.key_column_usage.columns.referenced_table_name,
            referenced_column_name: informationSchema.key_column_usage.columns.referenced_column_name,
        })
        .join(informationSchema.table_constraints, and(
            eq(informationSchema.key_column_usage.columns.constraint_name, informationSchema.table_constraints.columns.constraint_name),
            eq(informationSchema.key_column_usage.columns.table_schema, informationSchema.table_constraints.columns.table_schema)
        ))
        .where(and(
            eq(informationSchema.table_constraints.columns.constraint_type, 'FOREIGN KEY'),
            isNotNull(informationSchema.key_column_usage.columns.referenced_table_schema),
            schema ? eq(informationSchema.key_column_usage.columns.table_schema, schema) : eq(informationSchema.key_column_usage.columns.table_schema, Fn('database', []))
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
            referencesTable: `${r.referenced_table_schema}.${r.referenced_table_name}`,
            referencesColumn: r.referenced_column_name,
        });
    });

    const indexRows = await new SelectQueryBuilder(informationSchema.statistics)
        .select({
            table_schema: informationSchema.statistics.columns.table_schema,
            table_name: informationSchema.statistics.columns.table_name,
            index_name: informationSchema.statistics.columns.index_name,
            non_unique: informationSchema.statistics.columns.non_unique,
            column_name: informationSchema.statistics.columns.column_name,
        })
        .where(and(
            neq(informationSchema.statistics.columns.index_name, 'PRIMARY'),
            schema ? eq(informationSchema.statistics.columns.table_schema, schema) : eq(informationSchema.statistics.columns.table_schema, fn('database', []))
        ))
        .groupBy(informationSchema.statistics.columns.table_schema)
        .groupBy(informationSchema.statistics.columns.table_name)
        .groupBy(informationSchema.statistics.columns.index_name)
        .groupBy(informationSchema.statistics.columns.non_unique)
        .execute(executor, dialect);

    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!shouldIncludeTable(r.table_name, options)) return;
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
        autoIncrement: typeof r.extra === 'string' && r.extra.includes('auto_increment')
      };
      cols.columns.push(column);
    });

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const cols = (typeof r.cols === 'string' ? r.cols.split(',') : []).map((c: string) => ({ column: c.trim() }));
      const idx: DatabaseIndex = {
        name: r.index_name,
        columns: cols,
        unique: r.non_unique === 0
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    return { tables: Array.from(tablesByKey.values()) };
  }
};
