import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import type { ReferentialAction } from '../../../schema/column-types.js';
import { DbExecutor } from '../../execution/db-executor.js';

/** Row type for MySQL column information. */
type MysqlColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  column_type: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  extra: string | null;
  column_comment: string;
};

type MysqlPrimaryKeyRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
};

type MysqlTableRow = {
  table_schema: string;
  table_name: string;
  table_comment: string;
};

type MysqlIndexRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  non_unique: number;
  cols: string | null;
};

type MysqlForeignKeyRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
  referenced_table_schema: string;
  referenced_table_name: string;
  referenced_column_name: string;
  delete_rule: ReferentialAction;
  update_rule: ReferentialAction;
};

type MysqlForeignKeyEntry = {
  table: string;
  column: string;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  name?: string;
};

/** MySQL schema introspector. */
export const mysqlIntrospector: SchemaIntrospector = {
  async introspect(ctx: { executor: DbExecutor }, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const filterClause = schema ? 'table_schema = ?' : 'table_schema = database()';
    const params = schema ? [schema] : [];

    const tableRows = (await queryRows(
      ctx.executor,
      `
      SELECT table_schema, table_name, table_comment
      FROM information_schema.tables
      WHERE ${filterClause}
      `,
      params
    )) as MysqlTableRow[];
    const tableComments = new Map<string, string>();
    tableRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (r.table_comment) {
        tableComments.set(key, r.table_comment);
      }
    });

    const columnRows = (await queryRows(
      ctx.executor,
      `
      SELECT table_schema, table_name, column_name, column_type, data_type, is_nullable, column_default, extra, column_comment
      FROM information_schema.columns
      WHERE ${filterClause}
      ORDER BY table_name, ordinal_position
      `,
      params
    )) as MysqlColumnRow[];

    const pkRows = (await queryRows(
      ctx.executor,
      `
      SELECT table_schema, table_name, column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'PRIMARY' AND ${filterClause}
      ORDER BY ordinal_position
      `,
      params
    )) as MysqlPrimaryKeyRow[];

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const fkRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        key_column_usage.table_schema,
        key_column_usage.table_name,
        key_column_usage.column_name,
        key_column_usage.constraint_name,
        key_column_usage.referenced_table_schema,
        key_column_usage.referenced_table_name,
        key_column_usage.referenced_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.key_column_usage
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = key_column_usage.constraint_schema
        AND rc.constraint_name = key_column_usage.constraint_name
      WHERE ${filterClause} AND key_column_usage.referenced_table_name IS NOT NULL
      ORDER BY key_column_usage.table_name, key_column_usage.ordinal_position
      `,
      params
    )) as MysqlForeignKeyRow[];

    const fkMap = new Map<string, MysqlForeignKeyEntry[]>();
    fkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}.${r.column_name}`;
      const list = fkMap.get(key) || [];
      list.push({
        table: `${r.referenced_table_schema}.${r.referenced_table_name}`,
        column: r.referenced_column_name,
        onDelete: r.delete_rule,
        onUpdate: r.update_rule,
        name: r.constraint_name
      });
      fkMap.set(key, list);
    });

    const indexRows = (await queryRows(
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
    )) as MysqlIndexRow[];

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
          comment: tableComments.get(key) || undefined
        });
      }
      const cols = tablesByKey.get(key)!;
      const columnType = r.column_type || r.data_type;
      const comment = r.column_comment?.trim() ? r.column_comment : undefined;
      const column: DatabaseColumn = {
        name: r.column_name,
        type: columnType,
        notNull: r.is_nullable === 'NO',
        default: r.column_default ?? undefined,
        autoIncrement: typeof r.extra === 'string' && r.extra.includes('auto_increment'),
        comment
      };
      const fk = fkMap.get(`${key}.${r.column_name}`)?.[0];
      if (fk) {
        column.references = {
          table: fk.table,
          column: fk.column,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
          name: fk.name
        };
      }
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
