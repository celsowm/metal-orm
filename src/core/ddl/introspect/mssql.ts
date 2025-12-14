import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../execution/db-executor.js';

/** Row type for MSSQL column information. */
type MssqlColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean | number;
  is_identity: boolean | number;
  column_default: string | null;
};

/** Row type for MSSQL primary key information. */
type MssqlPrimaryKeyRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  key_ordinal: number;
};

/** Row type for MSSQL index information. */
type MssqlIndexRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  is_unique: boolean | number;
  has_filter: boolean | number;
  filter_definition: string | null;
};

/** Row type for MSSQL index column information. */
type MssqlIndexColumnRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  column_name: string;
  key_ordinal: number;
};

/** MSSQL schema introspector implementation. */
export const mssqlIntrospector: SchemaIntrospector = {
  /**
   * Introspects the MSSQL database schema.
   * @param ctx - The introspection context containing the database executor.
   * @param options - Options for introspection, such as schema filter.
   * @returns A promise that resolves to the introspected database schema.
   */
  async introspect(ctx: { executor: DbExecutor }, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const filterSchema = schema ? 'sch.name = @p1' : '1=1';
    const params = schema ? [schema] : [];

    const columnRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        c.name AS column_name,
        ty.name AS data_type,
        c.is_nullable,
        c.is_identity,
        object_definition(c.default_object_id) AS column_default
      FROM sys.columns c
      JOIN sys.tables t ON t.object_id = c.object_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE t.is_ms_shipped = 0 AND ${filterSchema}
      `,
      params
    )) as MssqlColumnRow[];

    const pkRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        c.name AS column_name,
        ic.key_ordinal
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      JOIN sys.tables t ON t.object_id = i.object_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      WHERE i.is_primary_key = 1 AND ${filterSchema}
      ORDER BY ic.key_ordinal
      `,
      params
    )) as MssqlPrimaryKeyRow[];

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const indexRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        i.name AS index_name,
        i.is_unique,
        i.has_filter,
        i.filter_definition
      FROM sys.indexes i
      JOIN sys.tables t ON t.object_id = i.object_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      WHERE i.is_primary_key = 0 AND i.is_hypothetical = 0 AND ${filterSchema}
      `,
      params
    )) as MssqlIndexRow[];

    const indexColsRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        i.name AS index_name,
        c.name AS column_name,
        ic.key_ordinal
      FROM sys.index_columns ic
      JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      JOIN sys.tables t ON t.object_id = i.object_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      WHERE i.is_primary_key = 0 AND ${filterSchema}
      ORDER BY ic.key_ordinal
      `,
      params
    )) as MssqlIndexColumnRow[];

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
          indexes: []
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
