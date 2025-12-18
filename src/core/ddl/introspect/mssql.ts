import type { ReferentialAction } from '../../../schema/column-types.js';
import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable, queryRows } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import type { IntrospectContext } from './context.js';
import { runSelectNode } from './run-select.js';
import type { SelectQueryNode, TableNode } from '../../ast/query.js';
import type { ColumnNode, ExpressionNode, FunctionNode } from '../../ast/expression-nodes.js';
import type { JoinNode } from '../../ast/join.js';
import { eq, and } from '../../ast/expression-builders.js';
import type { TableDef } from '../../../schema/table.js';
import {
  SysColumns,
  SysTables,
  SysSchemas,
  SysTypes,
  SysIndexes,
  SysIndexColumns,
  SysForeignKeys,
  SysForeignKeyColumns
} from './catalogs/mssql.js';
import { buildMssqlDataType, objectDefinition } from './functions/mssql.js';

type MssqlColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean | number;
  is_identity: boolean | number;
  column_default: string | null;
};

type MssqlPrimaryKeyRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  key_ordinal: number;
};

type MssqlIndexRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  is_unique: boolean | number;
  has_filter: boolean | number;
  filter_definition: string | null;
};

type MssqlIndexColumnRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  column_name: string;
  key_ordinal: number;
};

type MssqlForeignKeyRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
  referenced_schema: string;
  referenced_table: string;
  referenced_column: string;
  delete_rule: string | null;
  update_rule: string | null;
};

type MssqlTableCommentRow = {
  table_schema: string;
  table_name: string;
  comment: string | null;
};

type MssqlColumnCommentRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  comment: string | null;
};

type ForeignKeyEntry = {
  table: string;
  column: string;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  name?: string;
};

const normalizeReferentialAction = (value: string | null | undefined): ReferentialAction | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/_/g, ' ').toUpperCase();
  const allowed: ReferentialAction[] = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];
  return allowed.includes(normalized as ReferentialAction) ? (normalized as ReferentialAction) : undefined;
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

export const mssqlIntrospector: SchemaIntrospector = {
  async introspect(ctx: IntrospectContext, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema;
    const schemaCondition = schema ? eq(columnNode('sch', 'name'), schema) : undefined;
    const schemaFilter = schema ? 'AND sch.name = @p1' : '';
    const schemaParams = schema ? [schema] : [];
    const tableCommentRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        CONVERT(nvarchar(4000), ep.value) AS comment
      FROM sys.extended_properties ep
      JOIN sys.tables t ON t.object_id = ep.major_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      WHERE ep.class = 1
        AND ep.minor_id = 0
        AND ep.name = 'MS_Description'
        ${schemaFilter}
      `,
      schemaParams
    )) as MssqlTableCommentRow[];
    const columnCommentRows = (await queryRows(
      ctx.executor,
      `
      SELECT
        sch.name AS table_schema,
        t.name AS table_name,
        col.name AS column_name,
        CONVERT(nvarchar(4000), ep.value) AS comment
      FROM sys.extended_properties ep
      JOIN sys.columns col ON col.object_id = ep.major_id AND col.column_id = ep.minor_id
      JOIN sys.tables t ON t.object_id = col.object_id
      JOIN sys.schemas sch ON sch.schema_id = t.schema_id
      WHERE ep.class = 1
        AND ep.minor_id > 0
        AND ep.name = 'MS_Description'
        ${schemaFilter}
      `,
      schemaParams
    )) as MssqlColumnCommentRow[];
    const tableComments = new Map<string, string>();
    tableCommentRows.forEach(r => {
      if (!shouldIncludeTable(r.table_name, options)) return;
      if (!r.comment) return;
      const trimmed = r.comment.trim();
      if (!trimmed) return;
      tableComments.set(`${r.table_schema}.${r.table_name}`, trimmed);
    });
    const columnComments = new Map<string, string>();
    columnCommentRows.forEach(r => {
      if (!shouldIncludeTable(r.table_name, options)) return;
      if (!r.comment) return;
      const trimmed = r.comment.trim();
      if (!trimmed) return;
      columnComments.set(`${r.table_schema}.${r.table_name}.${r.column_name}`, trimmed);
    });

    const dataTypeExpression = buildMssqlDataType(
      { table: 'ty', name: 'name' },
      { table: 'c', name: 'max_length' },
      { table: 'c', name: 'precision' },
      { table: 'c', name: 'scale' }
    ) as FunctionNode;

    const defaultExpression = objectDefinition({ table: 'c', name: 'default_object_id' }) as FunctionNode;

    const columnsQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(SysColumns, 'c'),
      columns: [
        columnNode('sch', 'name', 'table_schema'),
        columnNode('t', 'name', 'table_name'),
        columnNode('c', 'name', 'column_name'),
        { ...dataTypeExpression, alias: 'data_type' },
        columnNode('c', 'is_nullable'),
        columnNode('c', 'is_identity'),
        { ...defaultExpression, alias: 'column_default' }
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 't'),
          condition: eq({ table: 't', name: 'object_id' }, { table: 'c', name: 'object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'sch'),
          condition: eq({ table: 'sch', name: 'schema_id' }, { table: 't', name: 'schema_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTypes, 'ty'),
          condition: eq({ table: 'ty', name: 'user_type_id' }, { table: 'c', name: 'user_type_id' })
        } as JoinNode
      ],
      where: combineConditions(
        eq({ table: 't', name: 'is_ms_shipped' }, 0),
        schemaCondition
      )
    };

    const pkQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(SysIndexes, 'i'),
      columns: [
        columnNode('sch', 'name', 'table_schema'),
        columnNode('t', 'name', 'table_name'),
        columnNode('c', 'name', 'column_name'),
        columnNode('ic', 'key_ordinal', 'key_ordinal')
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysIndexColumns, 'ic'),
          condition: and(
            eq({ table: 'ic', name: 'object_id' }, { table: 'i', name: 'object_id' }),
            eq({ table: 'ic', name: 'index_id' }, { table: 'i', name: 'index_id' })
          )
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysColumns, 'c'),
          condition: and(
            eq({ table: 'c', name: 'object_id' }, { table: 'ic', name: 'object_id' }),
            eq({ table: 'c', name: 'column_id' }, { table: 'ic', name: 'column_id' })
          )
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 't'),
          condition: eq({ table: 't', name: 'object_id' }, { table: 'i', name: 'object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'sch'),
          condition: eq({ table: 'sch', name: 'schema_id' }, { table: 't', name: 'schema_id' })
        } as JoinNode
      ],
      where: combineConditions(
        eq({ table: 'i', name: 'is_primary_key' }, 1),
        schemaCondition
      ),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('ic', 'key_ordinal'),
          direction: 'ASC'
        }
      ]
    };

    const fkQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(SysForeignKeyColumns, 'fkc'),
      columns: [
        columnNode('sch', 'name', 'table_schema'),
        columnNode('t', 'name', 'table_name'),
        columnNode('c', 'name', 'column_name'),
        columnNode('fk', 'name', 'constraint_name'),
        columnNode('rsch', 'name', 'referenced_schema'),
        columnNode('rt', 'name', 'referenced_table'),
        columnNode('rc', 'name', 'referenced_column'),
        columnNode('fk', 'delete_referential_action_desc', 'delete_rule'),
        columnNode('fk', 'update_referential_action_desc', 'update_rule')
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysForeignKeys, 'fk'),
          condition: eq({ table: 'fk', name: 'object_id' }, { table: 'fkc', name: 'constraint_object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 't'),
          condition: eq({ table: 't', name: 'object_id' }, { table: 'fkc', name: 'parent_object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'sch'),
          condition: eq({ table: 'sch', name: 'schema_id' }, { table: 't', name: 'schema_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysColumns, 'c'),
          condition: and(
            eq({ table: 'c', name: 'object_id' }, { table: 'fkc', name: 'parent_object_id' }),
            eq({ table: 'c', name: 'column_id' }, { table: 'fkc', name: 'parent_column_id' })
          )
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 'rt'),
          condition: eq({ table: 'rt', name: 'object_id' }, { table: 'fkc', name: 'referenced_object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'rsch'),
          condition: eq({ table: 'rsch', name: 'schema_id' }, { table: 'rt', name: 'schema_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysColumns, 'rc'),
          condition: and(
            eq({ table: 'rc', name: 'object_id' }, { table: 'fkc', name: 'referenced_object_id' }),
            eq({ table: 'rc', name: 'column_id' }, { table: 'fkc', name: 'referenced_column_id' })
          )
        } as JoinNode
      ],
      where: combineConditions(
        eq({ table: 't', name: 'is_ms_shipped' }, 0),
        schemaCondition
      ),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('fk', 'name'),
          direction: 'ASC'
        },
        {
          type: 'OrderBy',
          term: columnNode('fkc', 'constraint_column_id'),
          direction: 'ASC'
        }
      ]
    };

    const indexQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(SysIndexes, 'i'),
      columns: [
        columnNode('sch', 'name', 'table_schema'),
        columnNode('t', 'name', 'table_name'),
        columnNode('i', 'name', 'index_name'),
        columnNode('i', 'is_unique'),
        columnNode('i', 'has_filter'),
        columnNode('i', 'filter_definition')
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 't'),
          condition: eq({ table: 't', name: 'object_id' }, { table: 'i', name: 'object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'sch'),
          condition: eq({ table: 'sch', name: 'schema_id' }, { table: 't', name: 'schema_id' })
        } as JoinNode
      ],
      where: combineConditions(
        eq({ table: 'i', name: 'is_primary_key' }, 0),
        eq({ table: 'i', name: 'is_hypothetical' }, 0),
        schemaCondition
      )
    };

    const indexColumnsQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: tableNode(SysIndexColumns, 'ic'),
      columns: [
        columnNode('sch', 'name', 'table_schema'),
        columnNode('t', 'name', 'table_name'),
        columnNode('i', 'name', 'index_name'),
        columnNode('c', 'name', 'column_name'),
        columnNode('ic', 'key_ordinal', 'key_ordinal')
      ],
      joins: [
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysIndexes, 'i'),
          condition: and(
            eq({ table: 'ic', name: 'object_id' }, { table: 'i', name: 'object_id' }),
            eq({ table: 'ic', name: 'index_id' }, { table: 'i', name: 'index_id' })
          )
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysColumns, 'c'),
          condition: and(
            eq({ table: 'c', name: 'object_id' }, { table: 'ic', name: 'object_id' }),
            eq({ table: 'c', name: 'column_id' }, { table: 'ic', name: 'column_id' })
          )
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysTables, 't'),
          condition: eq({ table: 't', name: 'object_id' }, { table: 'i', name: 'object_id' })
        } as JoinNode,
        {
          type: 'Join',
          kind: 'INNER',
          table: tableNode(SysSchemas, 'sch'),
          condition: eq({ table: 'sch', name: 'schema_id' }, { table: 't', name: 'schema_id' })
        } as JoinNode
      ],
      where: combineConditions(
        eq({ table: 'i', name: 'is_primary_key' }, 0),
        schemaCondition
      ),
      orderBy: [
        {
          type: 'OrderBy',
          term: columnNode('ic', 'key_ordinal'),
          direction: 'ASC'
        }
      ]
    };

    const columnRows = (await runSelectNode<MssqlColumnRow>(columnsQuery, ctx)) as MssqlColumnRow[];
    const pkRows = (await runSelectNode<MssqlPrimaryKeyRow>(pkQuery, ctx)) as MssqlPrimaryKeyRow[];
    const fkRows = (await runSelectNode<MssqlForeignKeyRow>(fkQuery, ctx)) as MssqlForeignKeyRow[];
    const indexRows = (await runSelectNode<MssqlIndexRow>(indexQuery, ctx)) as MssqlIndexRow[];
    const indexColsRows = (await runSelectNode<MssqlIndexColumnRow>(indexColumnsQuery, ctx)) as MssqlIndexColumnRow[];

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const list = pkMap.get(key) || [];
      list.push(r.column_name);
      pkMap.set(key, list);
    });

    const fkMap = new Map<string, ForeignKeyEntry[]>();
    fkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}.${r.column_name}`;
      const list = fkMap.get(key) || [];
      list.push({
        table: `${r.referenced_schema}.${r.referenced_table}`,
        column: r.referenced_column,
        onDelete: normalizeReferentialAction(r.delete_rule),
        onUpdate: normalizeReferentialAction(r.update_rule),
        name: r.constraint_name
      });
      fkMap.set(key, list);
    });

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
          comment: tableComments.get(key)
        });
      }
      const table = tablesByKey.get(key)!;
      const column: DatabaseColumn = {
        name: r.column_name,
        type: r.data_type,
        notNull: r.is_nullable === false || r.is_nullable === 0,
        default: r.column_default ?? undefined,
        autoIncrement: !!r.is_identity
      };
      const columnComment = columnComments.get(`${key}.${r.column_name}`);
      if (columnComment) {
        column.comment = columnComment;
      }
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
      table.columns.push(column);
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
        where: r.has_filter ? r.filter_definition ?? undefined : undefined
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    return { tables: Array.from(tablesByKey.values()) };
  }
};
