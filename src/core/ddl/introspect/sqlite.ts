import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex } from '../schema-types.js';
import type { IntrospectContext } from './context.js';
import { runSelectNode } from './run-select.js';
import type { SelectQueryNode, TableNode } from '../../ast/query.js';
import type { ColumnNode } from '../../ast/expression-nodes.js';
import { eq, notLike, and, valueToOperand } from '../../ast/expression-builders.js';
import { fnTable } from '../../ast/builders.js';
import type { ReferentialAction } from '../../../schema/column-types.js';

type SqliteTableRow = {
  name: string;
};

type SqliteTableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type SqliteForeignKeyRow = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string | null;
  on_delete: string | null;
};

type SqliteIndexListRow = {
  seq: number;
  name: string;
  unique: number;
};

type SqliteIndexInfoRow = {
  seqno: number;
  cid: number;
  name: string;
};

const toReferentialAction = (value: string | null | undefined): ReferentialAction | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (
    normalized === 'NO ACTION' ||
    normalized === 'RESTRICT' ||
    normalized === 'CASCADE' ||
    normalized === 'SET NULL' ||
    normalized === 'SET DEFAULT'
  ) {
    return normalized as ReferentialAction;
  }
  return undefined;
};

const columnNode = (table: string, name: string, alias?: string): ColumnNode => ({
  type: 'Column',
  table,
  name,
  alias
});

const buildPragmaQuery = (
  name: string,
  table: string,
  alias: string,
  columnAliases: string[]
): SelectQueryNode => ({
  type: 'SelectQuery',
  from: fnTable(name, [valueToOperand(table)], alias, { columnAliases }),
  columns: columnAliases.map(column => columnNode(alias, column)),
  joins: []
});

const runPragma = async <T>(
  name: string,
  table: string,
  alias: string,
  columnAliases: string[],
  ctx: IntrospectContext
): Promise<T[]> => {
  const query = buildPragmaQuery(name, table, alias, columnAliases);
  return (await runSelectNode<T>(query, ctx)) as T[];
};

export const sqliteIntrospector: SchemaIntrospector = {
  async introspect(ctx: IntrospectContext, options: IntrospectOptions): Promise<DatabaseSchema> {
    const alias = 'sqlite_master';
    const tablesQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: { type: 'Table', name: 'sqlite_master' } as TableNode,
      columns: [columnNode(alias, 'name')],
      joins: [],
      where: and(
        eq(columnNode(alias, 'type'), 'table'),
        notLike(columnNode(alias, 'name'), 'sqlite_%')
      )
    };

    const tableRows = (await runSelectNode<SqliteTableRow>(tablesQuery, ctx)) as SqliteTableRow[];
    const tables: DatabaseTable[] = [];

    for (const row of tableRows) {
      const tableName = row.name;
      if (!shouldIncludeTable(tableName, options)) continue;

      const tableInfo = await runPragma<SqliteTableInfoRow>(
        'pragma_table_info',
        tableName,
        'ti',
        ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
        ctx
      );

      const foreignKeys = await runPragma<SqliteForeignKeyRow>(
        'pragma_foreign_key_list',
        tableName,
        'fk',
        ['id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match'],
        ctx
      );

      const indexList = await runPragma<SqliteIndexListRow>(
        'pragma_index_list',
        tableName,
        'idx',
        ['seq', 'name', 'unique'],
        ctx
      );

      const tableEntry: DatabaseTable = { name: tableName, columns: [], primaryKey: [], indexes: [] };

      tableInfo.forEach(info => {
        tableEntry.columns.push({
          name: info.name,
          type: info.type,
          notNull: info.notnull === 1,
          default: info.dflt_value ?? undefined,
          autoIncrement: false
        });
        if (info.pk && info.pk > 0) {
          tableEntry.primaryKey = tableEntry.primaryKey || [];
          tableEntry.primaryKey.push(info.name);
        }
      });

      foreignKeys.forEach(fk => {
        const column = tableEntry.columns.find(col => col.name === fk.from);
        if (column) {
          column.references = {
            table: fk.table,
            column: fk.to,
            onDelete: toReferentialAction(fk.on_delete),
            onUpdate: toReferentialAction(fk.on_update)
          };
        }
      });

      for (const idx of indexList) {
        if (!idx.name) continue;
        const indexColumns = await runPragma<SqliteIndexInfoRow>(
          'pragma_index_info',
          idx.name,
          'info',
          ['seqno', 'cid', 'name'],
          ctx
        );
        const idxEntry: DatabaseIndex = {
          name: idx.name,
          columns: indexColumns.map(col => ({ column: col.name })),
          unique: idx.unique === 1
        };
        tableEntry.indexes!.push(idxEntry);
      }

      tables.push(tableEntry);
    }

    return { tables };
  }
};
