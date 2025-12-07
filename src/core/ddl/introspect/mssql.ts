import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../../orm/db-executor.js';
import { SelectQueryBuilder } from '../../../query-builder/select.js';
import { defineTable } from '../../../schema/table.js';
import { col } from '../../../schema/column.js';
import { eq, and, neq, valueToOperand } from '../../../core/ast/expression.js';
import { SqlServerDialect } from '../../dialect/mssql/index.js';

const sys = {
    columns: defineTable('sys.columns', {
        name: col.varchar(255),
        object_id: col.varchar(255),
        is_nullable: col.boolean(),
        is_identity: col.boolean(),
        default_object_id: col.varchar(255),
        user_type_id: col.varchar(255),
    }),
    tables: defineTable('sys.tables', {
        name: col.string(),
        object_id: col.string(),
        schema_id: col.string(),
        is_ms_shipped: col.boolean(),
    }),
    schemas: defineTable('sys.schemas', {
        name: col.string(),
        schema_id: col.string(),
    }),
    types: defineTable('sys.types', {
        name: col.string(),
        user_type_id: col.string(),
    }),
    indexes: defineTable('sys.indexes', {
        name: col.string(),
        object_id: col.string(),
        index_id: col.string(),
        is_primary_key: col.boolean(),
        is_unique: col.boolean(),
        has_filter: col.boolean(),
        filter_definition: col.string(),
    }),
    index_columns: defineTable('sys.index_columns', {
        object_id: col.string(),
        index_id: col.string(),
        column_id: col.string(),
        key_ordinal: col.number(),
    }),
    foreign_keys: defineTable('sys.foreign_keys', {
        object_id: col.string(),
    }),
    foreign_key_columns: defineTable('sys.foreign_key_columns', {
        constraint_object_id: col.string(),
        parent_object_id: col.string(),
        parent_column_id: col.string(),
        referenced_object_id: col.string(),
        referenced_column_id: col.string(),
    }),
};

export const mssqlIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const dialect = new SqlServerDialect();

    const columnRows = await new SelectQueryBuilder(sys.columns)
        .select({
            table_schema: sys.schemas.columns.name,
            table_name: sys.tables.columns.name,
            column_name: sys.columns.columns.name,
            data_type: sys.types.columns.name,
            is_nullable: sys.columns.columns.is_nullable,
            is_identity: sys.columns.columns.is_identity,
            column_default: fn('object_definition', [sys.columns.columns.default_object_id]),
        })
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.columns.columns.object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .join(sys.types, eq(sys.types.columns.user_type_id, sys.columns.columns.user_type_id))
        .where(and(
            eq(sys.tables.columns.is_ms_shipped, false),
            schema ? eq(sys.schemas.columns.name, schema) : neq(1, 0)
        ))
        .execute(executor, dialect);

    const pkRows = await new SelectQueryBuilder(sys.indexes)
        .select({
            table_schema: sys.schemas.columns.name,
            table_name: sys.tables.columns.name,
            column_name: sys.columns.columns.name,
        })
        .join(sys.index_columns, and(
            eq(sys.index_columns.columns.object_id, sys.indexes.columns.object_id),
            eq(sys.index_columns.columns.index_id, sys.indexes.columns.index_id)
        ))
        .join(sys.columns, and(
            eq(sys.columns.columns.object_id, sys.index_columns.columns.object_id),
            eq(sys.columns.columns.column_id, sys.index_columns.columns.column_id)
        ))
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.indexes.columns.object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .where(and(
            eq(sys.indexes.columns.is_primary_key, true),
            schema ? eq(sys.schemas.columns.name, schema) : literal('1=1')
        ))
        .orderBy(sys.index_columns.columns.key_ordinal)
        .execute(executor, dialect);

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const fkRows = await new SelectQueryBuilder(sys.foreign_keys)
        .select({
            table_schema: sys.schemas.columns.name,
            table_name: sys.tables.columns.name,
            column_name: sys.columns.columns.name,
            referenced_table_schema: sys.schemas.columns.name,
            referenced_table_name: sys.tables.columns.name,
            referenced_column_name: sys.columns.columns.name,
        })
        .join(sys.foreign_key_columns, eq(sys.foreign_key_columns.columns.constraint_object_id, sys.foreign_keys.columns.object_id))
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.foreign_key_columns.columns.parent_object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .join(sys.columns, and(
            eq(sys.columns.columns.object_id, sys.foreign_key_columns.columns.parent_object_id),
            eq(sys.columns.columns.column_id, sys.foreign_key_columns.columns.parent_column_id)
        ))
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.foreign_key_columns.columns.referenced_object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .join(sys.columns, and(
            eq(sys.columns.columns.object_id, sys.foreign_key_columns.columns.referenced_object_id),
            eq(sys.columns.columns.column_id, sys.foreign_key_columns.columns.referenced_column_id)
        ))
        .where(schema ? eq(sys.schemas.columns.name, schema) : literal('1=1'))
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

    const indexRows = await new SelectQueryBuilder(sys.indexes)
        .select({
            table_schema: sys.schemas.columns.name,
            table_name: sys.tables.columns.name,
            index_name: sys.indexes.columns.name,
            is_unique: sys.indexes.columns.is_unique,
            has_filter: sys.indexes.columns.has_filter,
            filter_definition: sys.indexes.columns.filter_definition,
        })
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.indexes.columns.object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .where(and(
            eq(sys.indexes.columns.is_primary_key, false),
            eq(sys.indexes.columns.is_hypothetical, false),
            schema ? eq(sys.schemas.columns.name, schema) : valueToOperand('1=1')
        ))
        .execute(executor, dialect);

    const indexColsRows = await new SelectQueryBuilder(sys.index_columns)
        .select({
            table_schema: sys.schemas.columns.name,
            table_name: sys.tables.columns.name,
            index_name: sys.indexes.columns.name,
            column_name: sys.columns.columns.name,
            key_ordinal: sys.index_columns.columns.key_ordinal,
        })
        .join(sys.indexes, and(
            eq(sys.indexes.columns.object_id, sys.index_columns.columns.object_id),
            eq(sys.indexes.columns.index_id, sys.index_columns.columns.index_id)
        ))
        .join(sys.columns, and(
            eq(sys.columns.columns.object_id, sys.index_columns.columns.object_id),
            eq(sys.columns.columns.column_id, sys.index_columns.columns.column_id)
        ))
        .join(sys.tables, eq(sys.tables.columns.object_id, sys.indexes.columns.object_id))
        .join(sys.schemas, eq(sys.schemas.columns.schema_id, sys.tables.columns.schema_id))
        .where(and(
            eq(sys.indexes.columns.is_primary_key, false),
            schema ? eq(sys.schemas.columns.name, schema) : literal('1=1')
        ))
        .orderBy(sys.index_columns.columns.key_ordinal)
        .execute(executor, dialect);

    const indexColumnsMap = new Map<string, { column: string; order: number }[]>();
    indexColsRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}.${r.index_name}`;
      const list = indexColumnsMap.get(key) || [];
      list.push({ column: r.column_name, order: r.key_ordinal });
      indexColumnsMap.set(key, list);
    });

    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      if (!shouldIncludeTable(r.table_name, options)) return;
      const key = `${r.table_schema}.${r.table_name}`;
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
      const t = tablesByKey.get(key)!;
      const column: DatabaseColumn = {
        name: r.column_name,
        type: r.data_type,
        notNull: r.is_nullable === false || r.is_nullable === 0,
        default: r.column_default ?? undefined,
        autoIncrement: !!r.is_identity
      };
      t.columns.push(column);
    });

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const cols = (indexColumnsMap.get(`${r.table_schema}.${r.table_name}.${r.index_name}`) || [])
        .sort((a, b) => a.order - b.order)
        .map(c => ({ column: c.column }));
      const idx: DatabaseIndex = {
        name: r.index_name,
        columns: cols,
        unique: !!r.is_unique,
        where: r.has_filter ? r.filter_definition : undefined
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    return { tables: Array.from(tablesByKey.values()) };
  }
};
