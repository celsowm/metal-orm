import type { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import type { ReferentialAction } from '../../../schema/column.js';
import type { DbExecutor } from '../../execution/db-executor.js';
import type { IntrospectContext } from './context.js';
import { PgInformationSchemaColumns } from './catalogs/postgres.js';
import { PgKeyColumnUsage, PgTableConstraints, PgConstraintColumnUsage, PgReferentialConstraints, PgIndex, PgClass, PgNamespace, PgAttribute } from './catalogs/postgres.js';
import { SelectQueryBuilder } from '../../../query-builder/select.js';
import { eq, and } from '../../ast/expression-builders.js';
import type { SelectQueryNode, TableNode } from '../../ast/query.js';
import type { JoinNode } from '../../ast/join.js';
import type { ColumnNode, ExpressionNode } from '../../ast/expression-nodes.js';
import { fnTable } from '../../ast/builders.js';
import { runSelect, runSelectNode } from './run-select.js';

type ColumnIntrospectRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number | null;
};

type PrimaryKeyIntrospectRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  ordinal_position: number | null;
  constraint_name: string;
};

type ForeignKeyIntrospectRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
};

type ForeignKeyEntry = {
  table: string;
  column: string;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
};

type IndexQueryRow = {
  table_schema: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  predicate: string | null;
  attname: string | null;
  ord: number | null;
};

type IndexGroup = {
  table_schema: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  predicate: string | null;
  cols: { ord: number; att: string | null }[];
};

export const postgresIntrospector: SchemaIntrospector = {
  async introspect(ctx: IntrospectContext, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema || 'public';
    const tables: DatabaseTable[] = [];

    // Columns query
    const qbColumns = new SelectQueryBuilder(PgInformationSchemaColumns)
      .select({
        table_schema: PgInformationSchemaColumns.columns.table_schema,
        table_name: PgInformationSchemaColumns.columns.table_name,
        column_name: PgInformationSchemaColumns.columns.column_name,
        data_type: PgInformationSchemaColumns.columns.data_type,
        is_nullable: PgInformationSchemaColumns.columns.is_nullable,
        column_default: PgInformationSchemaColumns.columns.column_default,
        ordinal_position: PgInformationSchemaColumns.columns.ordinal_position
      })
      .where(eq(PgInformationSchemaColumns.columns.table_schema, schema))
      .orderBy(PgInformationSchemaColumns.columns.table_name)
      .orderBy(PgInformationSchemaColumns.columns.ordinal_position);

    const columnRows = await runSelect<ColumnIntrospectRow>(qbColumns, ctx);

    // Primary key columns query
    const qbPk = new SelectQueryBuilder(PgKeyColumnUsage)
      .select({
        table_schema: PgKeyColumnUsage.columns.table_schema,
        table_name: PgKeyColumnUsage.columns.table_name,
        column_name: PgKeyColumnUsage.columns.column_name,
        ordinal_position: PgKeyColumnUsage.columns.ordinal_position,
        constraint_name: PgKeyColumnUsage.columns.constraint_name
      })
      .innerJoin(PgTableConstraints, eq(PgTableConstraints.columns.constraint_name, PgKeyColumnUsage.columns.constraint_name))
      .where(eq(PgTableConstraints.columns.constraint_type, 'PRIMARY KEY'))
      .where(eq(PgKeyColumnUsage.columns.table_schema, schema))
      .orderBy(PgKeyColumnUsage.columns.table_name)
      .orderBy(PgKeyColumnUsage.columns.ordinal_position);

    const pkRows = await runSelect<PrimaryKeyIntrospectRow>(qbPk, ctx);

    // Build primary key map (grouped by table, ordered by ordinal_position)
    const pkMap = new Map<string, string[]>();
    const pkGrouped = new Map<string, { pos: number; col: string }[]>();
    for (const r of pkRows) {
      const key = `${r.table_schema}.${r.table_name}`;
      const arr = pkGrouped.get(key) ?? [];
      arr.push({ pos: r.ordinal_position ?? 0, col: r.column_name });
      pkGrouped.set(key, arr);
    }
    for (const [k, vals] of pkGrouped.entries()) {
      vals.sort((a, b) => (a.pos || 0) - (b.pos || 0));
      pkMap.set(k, vals.map(v => v.col));
    }

    // Foreign key columns query
    const qbFk = new SelectQueryBuilder(PgKeyColumnUsage)
      .select({
        table_schema: PgKeyColumnUsage.columns.table_schema,
        table_name: PgKeyColumnUsage.columns.table_name,
        column_name: PgKeyColumnUsage.columns.column_name,
        constraint_name: PgKeyColumnUsage.columns.constraint_name,
        foreign_table_schema: PgConstraintColumnUsage.columns.table_schema,
        foreign_table_name: PgConstraintColumnUsage.columns.table_name,
        foreign_column_name: PgConstraintColumnUsage.columns.column_name
      })
      .innerJoin(PgTableConstraints, eq(PgTableConstraints.columns.constraint_name, PgKeyColumnUsage.columns.constraint_name))
      .innerJoin(PgConstraintColumnUsage, eq(PgConstraintColumnUsage.columns.constraint_name, PgTableConstraints.columns.constraint_name))
      .innerJoin(PgReferentialConstraints, eq(PgReferentialConstraints.columns.constraint_name, PgTableConstraints.columns.constraint_name))
      .where(eq(PgTableConstraints.columns.constraint_type, 'FOREIGN KEY'))
      .where(eq(PgKeyColumnUsage.columns.table_schema, schema));

    const fkRows = await runSelect<ForeignKeyIntrospectRow>(qbFk, ctx);

    // Build foreign key map
    const fkMap = new Map<string, ForeignKeyEntry[]>();
    for (const r of fkRows) {
      const key = `${r.table_schema}.${r.table_name}.${r.column_name}`;
      const existing = fkMap.get(key) ?? [];
      existing.push({
        table: `${r.foreign_table_schema}.${r.foreign_table_name}`,
        column: r.foreign_column_name,
        onDelete: undefined,
        onUpdate: undefined
      });
      fkMap.set(key, existing);
    }

    // Index columns query using AST with FunctionTable for unnest
    const indexQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: { type: 'Table', name: 'pg_index', schema: 'pg_catalog', alias: 'i' } as TableNode,
      columns: [
        { type: 'Column', table: 'ns', name: 'nspname', alias: 'table_schema' } as ColumnNode,
        { type: 'Column', table: 'tbl', name: 'relname', alias: 'table_name' } as ColumnNode,
        { type: 'Column', table: 'idx', name: 'relname', alias: 'index_name' } as ColumnNode,
        { type: 'Column', table: 'i', name: 'indisunique', alias: 'is_unique' } as ColumnNode,
        { type: 'Column', table: 'i', name: 'indpred', alias: 'predicate' } as ColumnNode,
        { type: 'Column', table: 'att', name: 'attname', alias: 'attname' } as ColumnNode,
        { type: 'Column', table: 'arr', name: 'idx', alias: 'ord' } as ColumnNode
      ],
      joins: [
        // JOIN pg_class AS tbl ON tbl.oid = i.indrelid
        {
          type: 'Join',
          kind: 'INNER',
          table: { type: 'Table', name: 'pg_class', schema: 'pg_catalog', alias: 'tbl' } as TableNode,
          condition: eq({ table: 'tbl', name: 'oid' }, { table: 'i', name: 'indrelid' }) as ExpressionNode
        } as JoinNode,
        // JOIN pg_namespace AS ns ON ns.oid = tbl.relnamespace
        {
          type: 'Join',
          kind: 'INNER',
          table: { type: 'Table', name: 'pg_namespace', schema: 'pg_catalog', alias: 'ns' } as TableNode,
          condition: eq({ table: 'ns', name: 'oid' }, { table: 'tbl', name: 'relnamespace' }) as ExpressionNode
        } as JoinNode,
        // JOIN pg_class AS idx ON idx.oid = i.indexrelid
        {
          type: 'Join',
          kind: 'INNER',
          table: { type: 'Table', name: 'pg_class', schema: 'pg_catalog', alias: 'idx' } as TableNode,
          condition: eq({ table: 'idx', name: 'oid' }, { table: 'i', name: 'indexrelid' }) as ExpressionNode
        } as JoinNode,
        // LATERAL JOIN UNNEST(i.indkey) WITH ORDINALITY AS arr(attnum, idx)
        {
          type: 'Join',
          kind: 'INNER',
          table: fnTable('unnest', [{ type: 'Column', table: 'i', name: 'indkey' } as ColumnNode], 'arr', {
            lateral: true,
            withOrdinality: true,
            columnAliases: ['attnum', 'idx']
          }),
          condition: { type: 'BinaryExpression', left: { type: 'Literal', value: 1 }, operator: '=', right: { type: 'Literal', value: 1 } } as unknown as ExpressionNode
        } as JoinNode,
        // LEFT JOIN pg_attribute AS att ON att.attrelid = tbl.oid AND att.attnum = arr.attnum
        {
          type: 'Join',
          kind: 'LEFT',
          table: { type: 'Table', name: 'pg_attribute', schema: 'pg_catalog', alias: 'att' } as TableNode,
          condition: and(
            eq({ table: 'att', name: 'attrelid' }, { table: 'tbl', name: 'oid' }),
            eq({ table: 'att', name: 'attnum' }, { table: 'arr', name: 'attnum' })
          ) as ExpressionNode
        } as JoinNode
      ],
      where: and(
        eq({ table: 'ns', name: 'nspname' }, schema) as ExpressionNode,
        eq({ table: 'i', name: 'indisprimary' }, false) as ExpressionNode
      ) as ExpressionNode
    };

    const indexQueryRows = await runSelectNode<IndexQueryRow>(indexQuery, ctx);

    // Aggregate index rows by table/index to build final index list
    const indexGrouped = new Map<string, IndexGroup>();
    for (const r of indexQueryRows) {
      const key = `${r.table_schema}.${r.table_name}.${r.index_name}`;
      const entry = indexGrouped.get(key) ?? {
        table_schema: r.table_schema,
        table_name: r.table_name,
        index_name: r.index_name,
        is_unique: r.is_unique,
        predicate: r.predicate,
        cols: []
      };
      entry.cols.push({ ord: r.ord ?? 0, att: r.attname ?? null });
      indexGrouped.set(key, entry);
    }

    const indexRows = Array.from(indexGrouped.values()).map(v => ({
      table_schema: v.table_schema,
      table_name: v.table_name,
      index_name: v.index_name,
      is_unique: v.is_unique,
      predicate: v.predicate,
      column_names: v.cols.sort((a, b) => (a.ord || 0) - (b.ord || 0)).map(c => c.att).filter(Boolean)
    }));

    // Build final schema
    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!shouldIncludeTable(r.table_name, options)) {
        return;
      }
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
      const fk = fkMap.get(`${r.table_schema}.${r.table_name}.${r.column_name}`)?.[0];
      const column: DatabaseColumn = {
        name: r.column_name,
        type: r.data_type,
        notNull: r.is_nullable === 'NO',
        default: r.column_default ?? undefined,
        references: fk
          ? {
            table: fk.table,
            column: fk.column,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate
          }
          : undefined
      };
      cols.columns.push(column);
    });

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const idx: DatabaseIndex = {
        name: r.index_name,
        columns: (r.column_names || []).map((c: string) => ({ column: c })),
        unique: !!r.is_unique,
        where: r.predicate || undefined
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    tables.push(...tablesByKey.values());
    return { tables };
  }
};
