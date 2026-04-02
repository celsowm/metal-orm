import type { ReferentialAction } from '../../../schema/column-types.js';
import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable, shouldIncludeView } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn, DatabaseView } from '../schema-types.js';
import type { IntrospectContext } from './context.js';
import { runSelectNode } from './run-select.js';
import type { SelectQueryNode, TableNode } from '../../ast/query.js';
import type { ColumnNode, ExpressionNode, FunctionNode } from '../../ast/expression-nodes.js';
import type { JoinNode } from '../../ast/join.js';
import { eq, neq, and, isNotNull } from '../../ast/expression-builders.js';
import { groupConcat } from '../../ast/aggregate-functions.js';
import type { TableDef } from '../../../schema/table.js';
import {
  InformationSchemaTables,
  InformationSchemaColumns,
  InformationSchemaKeyColumnUsage,
  InformationSchemaReferentialConstraints,
  InformationSchemaStatistics
} from './catalogs/mysql.js';

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
  delete_rule: string;
  update_rule: string;
};

type MysqlForeignKeyEntry = {
  table: string;
  column: string;
  onDelete?: string;
  onUpdate?: string;
  name?: string;
};

const tableNode = (table: TableDef, alias: string): TableNode => ({
  type: 'Table',
  name: table.name,
  schema: table.schema,
  alias
});

const columnNode = (table: string, name: string, alias?: string): ColumnNode => ({
  type: 'Column',
  table,
  name,
  alias
});

const combineConditions = (...expressions: (ExpressionNode | undefined)[]): ExpressionNode | undefined => {
  const filtered = expressions.filter(Boolean) as ExpressionNode[];
  if (!filtered.length) return undefined;
  if (filtered.length === 1) return filtered[0];
  return and(...filtered);
};

const databaseFunction: FunctionNode = {
  type: 'Function',
  name: 'DATABASE',
  fn: 'DATABASE',
  args: []
};

const readMysqlField = (row: object, field: string): unknown => {
  const record = row as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(record, field)) {
    return record[field];
  }

  const lower = field.toLowerCase();
  if (lower !== field && Object.prototype.hasOwnProperty.call(record, lower)) {
    return record[lower];
  }

  const upper = field.toUpperCase();
  if (upper !== field && Object.prototype.hasOwnProperty.call(record, upper)) {
    return record[upper];
  }

  return undefined;
};

const readMysqlStringField = (row: object, field: string): string | undefined => {
  const value = readMysqlField(row, field);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Schema introspector for MySQL.
 * Queries information_schema tables to extract schema metadata.
 */
export const mysqlIntrospector: SchemaIntrospector = {
  async introspect(ctx: IntrospectContext, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;

    const buildSchemaCondition = (alias: string): ExpressionNode =>
      schema
        ? eq(columnNode(alias, 'table_schema'), schema)
        : eq(columnNode(alias, 'table_schema'), databaseFunction);

    const tablesQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(InformationSchemaTables, 't'),
      columns: [
        columnNode('t', 'table_schema'),
        columnNode('t', 'table_name'),
        columnNode('t', 'table_comment')
      ],
      joins: [],
      where: buildSchemaCondition('t')
    };

    const columnsQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(InformationSchemaColumns, 'c'),
      columns: [
        columnNode('c', 'table_schema'),
        columnNode('c', 'table_name'),
        columnNode('c', 'column_name'),
        columnNode('c', 'column_type'),
        columnNode('c', 'data_type'),
        columnNode('c', 'is_nullable'),
        columnNode('c', 'column_default'),
        columnNode('c', 'extra'),
        columnNode('c', 'column_comment')
      ],
      joins: [],
      where: buildSchemaCondition('c'),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('c', 'table_name'),
          direction: 'ASC'
        },
        {
          type: 'OrderBy',
          term: columnNode('c', 'ordinal_position'),
          direction: 'ASC'
        }
      ]
    };

    const pkQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(InformationSchemaKeyColumnUsage, 'kcu'),
      columns: [
        columnNode('kcu', 'table_schema'),
        columnNode('kcu', 'table_name'),
        columnNode('kcu', 'column_name')
      ],
      joins: [],
      where: combineConditions(
        eq(columnNode('kcu', 'constraint_name'), 'PRIMARY'),
        buildSchemaCondition('kcu')
      ),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('kcu', 'ordinal_position'),
          direction: 'ASC'
        }
      ]
    };

    const fkQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(InformationSchemaKeyColumnUsage, 'kcu'),
      columns: [
        columnNode('kcu', 'table_schema'),
        columnNode('kcu', 'table_name'),
        columnNode('kcu', 'column_name'),
        columnNode('kcu', 'constraint_name'),
        columnNode('kcu', 'referenced_table_schema'),
        columnNode('kcu', 'referenced_table_name'),
        columnNode('kcu', 'referenced_column_name'),
        columnNode('rc', 'delete_rule'),
        columnNode('rc', 'update_rule')
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(InformationSchemaReferentialConstraints, 'rc'),
          condition: and(
            eq({ table: 'rc', name: 'constraint_schema' }, { table: 'kcu', name: 'constraint_schema' }),
            eq({ table: 'rc', name: 'constraint_name' }, { table: 'kcu', name: 'constraint_name' })
          )
        } as JoinNode
      ],
      where: combineConditions(
        isNotNull(columnNode('kcu', 'referenced_table_name')),
        buildSchemaCondition('kcu')
      ),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('kcu', 'table_name'),
          direction: 'ASC'
        },
        {
          type: 'OrderBy',
          term: columnNode('kcu', 'ordinal_position'),
          direction: 'ASC'
        }
      ]
    };

    const indexQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(InformationSchemaStatistics, 'stats'),
      columns: [
        columnNode('stats', 'table_schema'),
        columnNode('stats', 'table_name'),
        columnNode('stats', 'index_name'),
        columnNode('stats', 'non_unique'),
        {
          ...groupConcat(columnNode('stats', 'column_name'), {
            orderBy: [{ column: columnNode('stats', 'seq_in_index') }]
          }),
          alias: 'cols'
        }
      ],
      joins: [],
      where: combineConditions(
        neq(columnNode('stats', 'index_name'), 'PRIMARY'),
        buildSchemaCondition('stats')
      ),
      groupBy: [
        columnNode('stats', 'table_schema'),
        columnNode('stats', 'table_name'),
        columnNode('stats', 'index_name'),
        columnNode('stats', 'non_unique')
      ]
    };

    const tableRows = (await runSelectNode<MysqlTableRow>(tablesQuery, ctx)) as MysqlTableRow[];
    const columnRows = (await runSelectNode<MysqlColumnRow>(columnsQuery, ctx)) as MysqlColumnRow[];
    const pkRows = (await runSelectNode<MysqlPrimaryKeyRow>(pkQuery, ctx)) as MysqlPrimaryKeyRow[];
    const fkRows = (await runSelectNode<MysqlForeignKeyRow>(fkQuery, ctx)) as MysqlForeignKeyRow[];
    const indexRows = (await runSelectNode<MysqlIndexRow>(indexQuery, ctx)) as MysqlIndexRow[];

    const tableComments = new Map<string, string>();
    tableRows.forEach(r => {
      const tableSchema = readMysqlStringField(r, 'table_schema');
      const tableName = readMysqlStringField(r, 'table_name');
      const tableComment = readMysqlStringField(r, 'table_comment');
      if (!tableSchema || !tableName) return;
      const key = `${tableSchema}.${tableName}`;
      if (tableComment) {
        tableComments.set(key, tableComment);
      }
    });

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const tableSchema = readMysqlStringField(r, 'table_schema');
      const tableName = readMysqlStringField(r, 'table_name');
      const columnName = readMysqlStringField(r, 'column_name');
      if (!tableSchema || !tableName || !columnName) return;
      const key = `${tableSchema}.${tableName}`;
      const list = pkMap.get(key) || [];
      list.push(columnName);
      pkMap.set(key, list);
    });

    const fkMap = new Map<string, MysqlForeignKeyEntry[]>();
    fkRows.forEach(r => {
      const tableSchema = readMysqlStringField(r, 'table_schema');
      const tableName = readMysqlStringField(r, 'table_name');
      const columnName = readMysqlStringField(r, 'column_name');
      const constraintName = readMysqlStringField(r, 'constraint_name');
      const referencedTableSchema = readMysqlStringField(r, 'referenced_table_schema');
      const referencedTableName = readMysqlStringField(r, 'referenced_table_name');
      const referencedColumnName = readMysqlStringField(r, 'referenced_column_name');
      const deleteRule = readMysqlStringField(r, 'delete_rule');
      const updateRule = readMysqlStringField(r, 'update_rule');
      if (
        !tableSchema ||
        !tableName ||
        !columnName ||
        !constraintName ||
        !referencedTableSchema ||
        !referencedTableName ||
        !referencedColumnName
      ) {
        return;
      }
      const key = `${tableSchema}.${tableName}.${columnName}`;
      const list = fkMap.get(key) || [];
      list.push({
        table: `${referencedTableSchema}.${referencedTableName}`,
        column: referencedColumnName,
        onDelete: deleteRule,
        onUpdate: updateRule,
        name: constraintName
      });
      fkMap.set(key, list);
    });

    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      const tableSchema = readMysqlStringField(r, 'table_schema');
      const tableName = readMysqlStringField(r, 'table_name');
      const columnName = readMysqlStringField(r, 'column_name');
      const columnType = readMysqlStringField(r, 'column_type') || readMysqlStringField(r, 'data_type');
      const isNullable = readMysqlStringField(r, 'is_nullable');
      const columnDefault = readMysqlField(r, 'column_default');
      const extra = readMysqlStringField(r, 'extra');
      const columnComment = readMysqlStringField(r, 'column_comment');
      if (!tableSchema || !tableName || !columnName || !columnType || !isNullable) return;
      const key = `${tableSchema}.${tableName}`;
      if (!shouldIncludeTable(tableName, options)) return;
      if (!tablesByKey.has(key)) {
        tablesByKey.set(key, {
          name: tableName,
          schema: tableSchema,
          columns: [],
          primaryKey: pkMap.get(key) || [],
          indexes: [],
          comment: tableComments.get(key) || undefined
        });
      }
      const table = tablesByKey.get(key)!;
      const comment = columnComment?.trim() ? columnComment : undefined;
      const column: DatabaseColumn = {
        name: columnName,
        type: columnType,
        notNull: isNullable === 'NO',
        default: columnDefault ?? undefined,
        autoIncrement: typeof extra === 'string' && extra.includes('auto_increment'),
        comment
      };
      const fk = fkMap.get(`${key}.${columnName}`)?.[0];
      if (fk) {
        column.references = {
          table: fk.table,
          column: fk.column,
          onDelete: fk.onDelete as ReferentialAction | undefined,
          onUpdate: fk.onUpdate as ReferentialAction | undefined,
          name: fk.name
        };
      }
      table.columns.push(column);
    });

    indexRows.forEach(r => {
      const tableSchema = readMysqlStringField(r, 'table_schema');
      const tableName = readMysqlStringField(r, 'table_name');
      const indexName = readMysqlStringField(r, 'index_name');
      const nonUnique = readMysqlField(r, 'non_unique');
      const colsValue = readMysqlField(r, 'cols');
      if (!tableSchema || !tableName || !indexName) return;
      const key = `${tableSchema}.${tableName}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const cols = (typeof colsValue === 'string' ? colsValue.split(',') : []).map(c => ({ column: c.trim() }));
      const idx: DatabaseIndex = {
        name: indexName,
        columns: cols,
        unique: Number(nonUnique) === 0
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    const tables = Array.from(tablesByKey.values());

    // Views introspection
    const views: DatabaseView[] = [];
    if (options.includeViews) {
      const viewsQuery: SelectQueryNode = {
        type: 'SelectQuery',
        from: {
          type: 'Table',
          name: 'VIEWS',
          schema: 'information_schema',
          alias: 'v'
        } as TableNode,
        columns: [
          columnNode('v', 'TABLE_SCHEMA', 'table_schema'),
          columnNode('v', 'TABLE_NAME', 'table_name'),
          columnNode('v', 'VIEW_DEFINITION', 'view_definition')
        ],
        joins: [],
        where: buildSchemaCondition('v')
      };

      const viewColumnsQuery: SelectQueryNode = {
        type: 'SelectQuery',
        from: tableNode(InformationSchemaColumns, 'c'),
        columns: [
          columnNode('c', 'table_schema'),
          columnNode('c', 'table_name'),
          columnNode('c', 'column_name'),
          columnNode('c', 'column_type'),
          columnNode('c', 'data_type'),
          columnNode('c', 'is_nullable'),
          columnNode('c', 'column_comment')
        ],
        joins: [
          {
            type: 'Join',
            kind: 'INNER',
            table: {
              type: 'Table',
              name: 'VIEWS',
              schema: 'information_schema',
              alias: 'v'
            } as TableNode,
            condition: and(
              eq({ table: 'v', name: 'TABLE_SCHEMA' }, { table: 'c', name: 'table_schema' }),
              eq({ table: 'v', name: 'TABLE_NAME' }, { table: 'c', name: 'table_name' })
            )
          } as JoinNode
        ],
        where: buildSchemaCondition('c'),
        orderBy: [
          { type: 'OrderBy', term: columnNode('c', 'table_name'), direction: 'ASC' },
          { type: 'OrderBy', term: columnNode('c', 'ordinal_position'), direction: 'ASC' }
        ]
      };

      type ViewRow = { table_schema: string; table_name: string; view_definition: string | null };
      type ViewColumnRow = {
        table_schema: string;
        table_name: string;
        column_name: string;
        column_type: string;
        data_type: string;
        is_nullable: string;
        column_comment: string;
      };

      const viewRows = await runSelectNode<ViewRow>(viewsQuery, ctx);
      const viewColumnRows = await runSelectNode<ViewColumnRow>(viewColumnsQuery, ctx);

      const viewsByKey = new Map<string, DatabaseView>();

      for (const r of viewRows) {
        const tableSchema = readMysqlStringField(r, 'table_schema');
        const tableName = readMysqlStringField(r, 'table_name');
        const viewDefinition = readMysqlStringField(r, 'view_definition');
        if (!tableSchema || !tableName) continue;
        if (!shouldIncludeView(tableName, options)) continue;
        const key = `${tableSchema}.${tableName}`;
        viewsByKey.set(key, {
          name: tableName,
          schema: tableSchema,
          columns: [],
          definition: viewDefinition || undefined
        });
      }

      for (const r of viewColumnRows) {
        const tableSchema = readMysqlStringField(r, 'table_schema');
        const tableName = readMysqlStringField(r, 'table_name');
        const columnName = readMysqlStringField(r, 'column_name');
        const columnType = readMysqlStringField(r, 'column_type') || readMysqlStringField(r, 'data_type');
        const isNullable = readMysqlStringField(r, 'is_nullable');
        const columnComment = readMysqlStringField(r, 'column_comment');
        if (!tableSchema || !tableName || !columnName || !columnType || !isNullable) continue;
        const key = `${tableSchema}.${tableName}`;
        const view = viewsByKey.get(key);
        if (!view) continue;
        const column: DatabaseColumn = {
          name: columnName,
          type: columnType,
          notNull: isNullable === 'NO',
          comment: columnComment?.trim() || undefined
        };
        view.columns.push(column);
      }

      views.push(...viewsByKey.values());
    }

    return { tables, views: views.length > 0 ? views : undefined };
  }
};
