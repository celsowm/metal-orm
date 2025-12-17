import type { ReferentialAction } from '../../../schema/column-types.js';
import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
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
      const key = `${r.table_schema}.${r.table_name}`;
      if (r.table_comment) {
        tableComments.set(key, r.table_comment);
      }
    });

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

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
      const table = tablesByKey.get(key)!;
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
          onDelete: fk.onDelete as ReferentialAction | undefined,
          onUpdate: fk.onUpdate as ReferentialAction | undefined,
          name: fk.name
        };
      }
      table.columns.push(column);
    });

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const cols = (typeof r.cols === 'string' ? r.cols.split(',') : []).map(c => ({ column: c.trim() }));
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
