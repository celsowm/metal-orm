import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../execution/db-executor.js';

export const mysqlIntrospector: SchemaIntrospector = {
  async introspect(ctx: { executor: DbExecutor }, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const filterClause = schema ? 'table_schema = ?' : 'table_schema = database()';
    const params = schema ? [schema] : [];

    const columnRows = await queryRows(
      ctx.executor,
      `
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default, extra
      FROM information_schema.columns
      WHERE ${filterClause}
      ORDER BY table_name, ordinal_position
      `,
      params
    );

    const pkRows = await queryRows(
      ctx.executor,
      `
      SELECT table_schema, table_name, column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'PRIMARY' AND ${filterClause}
      ORDER BY ordinal_position
      `,
      params
    );

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const indexRows = await queryRows(
      ctx.executor,
      `
      SELECT
        table_schema,
        table_name,
        index_name,
        non_unique,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
      FROM information_schema.statistics
      WHERE ${filterClause} AND index_name <> 'PRIMARY'
      GROUP BY table_schema, table_name, index_name, non_unique
      `,
      params
    );

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
          indexes: []
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
