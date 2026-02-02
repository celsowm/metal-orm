import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable, shouldIncludeView, queryRows } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn, DatabaseView } from '../schema-types.js';
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

const loadSqliteSchemaComments = async (ctx: IntrospectContext) => {
  const tableComments = new Map<string, string>();
  const columnComments = new Map<string, string>();
  const tableExists = await queryRows(
    ctx.executor,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_comments' LIMIT 1`
  );
  if (!tableExists.length) {
    return { tableComments, columnComments };
  }

  const commentRows = await queryRows(
    ctx.executor,
    `SELECT object_type, schema_name, table_name, column_name, comment FROM schema_comments`
  );
  for (const row of commentRows) {
    const objectType = typeof row.object_type === 'string' ? row.object_type.toLowerCase() : '';
    const tableName = typeof row.table_name === 'string' ? row.table_name : '';
    if (!tableName) continue;
    const columnName = typeof row.column_name === 'string' ? row.column_name : '';
    const schemaName = typeof row.schema_name === 'string' ? row.schema_name : '';
    const rawComment = row.comment;
    if (rawComment == null) continue;
    const commentText = String(rawComment).trim();
    if (!commentText) continue;

    const addTableComment = () => {
      tableComments.set(tableName, commentText);
      if (schemaName) {
        tableComments.set(`${schemaName}.${tableName}`, commentText);
      }
    };
    const addColumnComment = () => {
      columnComments.set(`${tableName}.${columnName}`, commentText);
      if (schemaName) {
        columnComments.set(`${schemaName}.${tableName}.${columnName}`, commentText);
      }
    };

    if (objectType === 'table') {
      addTableComment();
    } else if (objectType === 'column' && columnName) {
      addColumnComment();
    }
  }

  return {
    tableComments,
    columnComments
  };
};

/**
 * Schema introspector for SQLite.
 * Uses PRAGMA commands and sqlite_master to extract schema metadata.
 */
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

    const { tableComments, columnComments } = await loadSqliteSchemaComments(ctx);
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

      const tableEntry: DatabaseTable = {
        name: tableName,
        columns: [],
        primaryKey: [],
        indexes: [],
        comment: tableComments.get(tableName)
      };

      tableInfo.forEach(info => {
        const column: DatabaseColumn = {
          name: info.name,
          type: info.type,
          notNull: info.notnull === 1,
          default: info.dflt_value ?? undefined,
          autoIncrement: false
        };
        const columnComment = columnComments.get(`${tableName}.${info.name}`);
        if (columnComment) {
          column.comment = columnComment;
        }
        tableEntry.columns.push(column);
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

    // Views introspection
    const views: DatabaseView[] = [];
    if (options.includeViews) {
      const viewsQuery: SelectQueryNode = {
        type: 'SelectQuery',
        from: { type: 'Table', name: 'sqlite_master' } as TableNode,
        columns: [
          columnNode(alias, 'name'),
          columnNode(alias, 'sql')
        ],
        joins: [],
        where: eq(columnNode(alias, 'type'), 'view')
      };

      type ViewRow = { name: string; sql: string | null };
      const viewRows = (await runSelectNode<ViewRow>(viewsQuery, ctx)) as ViewRow[];

      for (const row of viewRows) {
        const viewName = row.name;
        if (!shouldIncludeView(viewName, options)) continue;

        const viewInfo = await runPragma<SqliteTableInfoRow>(
          'pragma_table_info',
          viewName,
          'ti',
          ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
          ctx
        );

        const viewEntry: DatabaseView = {
          name: viewName,
          columns: [],
          definition: row.sql || undefined,
          comment: tableComments.get(viewName)
        };

        viewInfo.forEach(info => {
          const column: DatabaseColumn = {
            name: info.name,
            type: info.type,
            notNull: info.notnull === 1
          };
          const colComment = columnComments.get(`${viewName}.${info.name}`);
          if (colComment) column.comment = colComment;
          viewEntry.columns.push(column);
        });

        views.push(viewEntry);
      }
    }

    return { tables, views: views.length > 0 ? views : undefined };
  }
};
