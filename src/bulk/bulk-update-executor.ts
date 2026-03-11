import { UpdateQueryBuilder } from '../query-builder/update.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { eq, and, inList } from '../core/ast/expression-builders.js';
import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { BulkUpdateOptions, ChunkOutcome, UpdateRow } from './bulk-types.js';
import type { ValueOperandInput } from '../core/ast/expression.js';
import type { ExpressionNode } from '../core/ast/expression-nodes.js';
import { BulkBaseExecutor, type BulkExecutorOptions } from './bulk-executor.base.js';
import { resolveReturningColumns, flattenQueryResults, executeCompiled, createBulkExecutionContext } from './bulk-context.js';
import { splitIntoChunks, runWithConcurrency, runChunk, maybeTransaction, aggregateOutcomes, aggregateOutcomesWithTimings } from './bulk-utils.js';

interface UpdateExecutorOptions extends BulkExecutorOptions {
  by?: string | string[];
  where?: ExpressionNode;
  returning?: boolean | import('../schema/column-types.js').ColumnDef[];
}

function resolveByColumns(table: TableDef, by: string | string[] | undefined): string[] {
  if (!by) return [findPrimaryKey(table)];
  return Array.isArray(by) ? by : [by];
}

export class BulkUpdateExecutor extends BulkBaseExecutor<UpdateExecutorOptions> {
  private readonly byColumns: string[];

  constructor(
    session: OrmSession,
    table: TableDef,
    rows: UpdateRow[],
    options: BulkUpdateOptions = {}
  ) {
    super(session, table, rows, options);
    this.byColumns = resolveByColumns(table, options.by);
  }

  protected async executeChunk(chunk: UpdateRow[], chunkIndex: number): Promise<ChunkOutcome> {
    const allReturning: Record<string, unknown>[] = [];
    const returningColumns = resolveReturningColumns(this.ctx, this.table, this.options.returning);
    const extraWhere = this.options.where;

    for (const row of chunk) {
      const predicates = this.byColumns.map(colName => {
        const col = this.table.columns[colName];
        if (!col) {
          throw new Error(
            `bulkUpdate: column "${colName}" not found in table "${this.table.name}"`
          );
        }
        const val = row[colName];
        if (val === undefined) {
          throw new Error(
            `bulkUpdate: row is missing the identity column "${colName}" required by the "by" option`
          );
        }
        return eq(col, val as ValueOperandInput);
      });

      const whereExpr: ExpressionNode =
        predicates.length === 1
          ? predicates[0]
          : predicates.reduce((acc, p) => and(acc, p) as ExpressionNode, predicates[0]);

      const finalWhere = extraWhere ? and(whereExpr, extraWhere) as ExpressionNode : whereExpr;

      const bySet = new Set(this.byColumns);
      const setPayload: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (!bySet.has(key) && key in this.table.columns) {
          setPayload[key] = val;
        }
      }

      if (!Object.keys(setPayload).length) continue;

      let builder = new UpdateQueryBuilder(this.table).set(setPayload).where(finalWhere);

      if (returningColumns?.length) {
        builder = builder.returning(...returningColumns);
      }

      const compiled = builder.compile(this.ctx.dialect);
      const resultSets = await executeCompiled(this.ctx, compiled);

      if (returningColumns) {
        allReturning.push(...flattenQueryResults(resultSets));
      }
    }

    return {
      processedRows: chunk.length,
      returning: allReturning,
      elapsedMs: 0,
    };
  }
}

export async function bulkUpdate<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  rows: UpdateRow[],
  options: BulkUpdateOptions = {}
): Promise<import('./bulk-types.js').BulkResult> {
  if (!rows.length) {
    return { processedRows: 0, chunksExecuted: 0, returning: [] };
  }

  const executor = new BulkUpdateExecutor(session, table, rows, options);
  return executor.execute();
}

const DEFAULT_BULK_UPDATE_WHERE_CHUNK_SIZE = 500;

export async function bulkUpdateWhere<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  ids: ValueOperandInput[],
  set: Record<string, ValueOperandInput>,
  options: Omit<BulkUpdateOptions, 'by' | 'returning'> & {
    by?: string;
    returning?: boolean | import('../schema/column-types.js').ColumnDef[];
  } = {}
): Promise<import('./bulk-types.js').BulkResult> {
  if (!ids.length) {
    return { processedRows: 0, chunksExecuted: 0, returning: [] };
  }

  const {
    chunkSize = DEFAULT_BULK_UPDATE_WHERE_CHUNK_SIZE,
    concurrency = 'sequential',
    transactional = true,
    timing = false,
    onChunkComplete,
    by,
    where: extraWhere,
    returning,
  } = options;

  const ctx = createBulkExecutionContext(session);
  const byColumnName = by ?? findPrimaryKey(table);
  const byColumn = table.columns[byColumnName];
  if (!byColumn) {
    throw new Error(
      `bulkUpdateWhere: column "${byColumnName}" not found in table "${table.name}"`
    );
  }

  const returningColumns = resolveReturningColumns(ctx, table, returning);
  const chunks = splitIntoChunks(ids, chunkSize);
  const totalChunks = chunks.length;

  const buildTask = (chunk: ValueOperandInput[], chunkIndex: number) => async (): Promise<ChunkOutcome> => {
    return runChunk(
      async () => {
        const inExpr = inList(byColumn, chunk as any);
        const finalWhere = extraWhere ? and(inExpr, extraWhere) : inExpr;

        let builder = new UpdateQueryBuilder(table).set(set as Record<string, unknown>).where(finalWhere);

        if (returningColumns?.length) {
          builder = builder.returning(...returningColumns);
        }

        const compiled = builder.compile(ctx.dialect);
        const resultSets = await executeCompiled(ctx, compiled);

        return {
          processedRows: chunk.length,
          returning: returningColumns ? flattenQueryResults(resultSets) : [],
          elapsedMs: 0,
        };
      },
      chunkIndex,
      totalChunks,
      chunk.length,
      timing,
      onChunkComplete
    );
  };

  const tasks = chunks.map((chunk, i) => buildTask(chunk, i));

  const outcomes = await maybeTransaction(
    session,
    transactional,
    () => runWithConcurrency(tasks, concurrency)
  );

  return timing
    ? aggregateOutcomesWithTimings(outcomes)
    : aggregateOutcomes(outcomes);
}
