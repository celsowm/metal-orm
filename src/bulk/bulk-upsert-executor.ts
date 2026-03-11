import { InsertQueryBuilder } from '../query-builder/insert.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { BulkUpsertOptions, ChunkOutcome, InsertRow } from './bulk-types.js';
import type { UpsertClause } from '../core/ast/query.js';
import type { ValueOperandInput } from '../core/ast/expression.js';
import type { ColumnNode } from '../core/ast/expression.js';
import { BulkBaseExecutor, type BulkExecutorOptions } from './bulk-executor.base.js';
import { resolveReturningColumns, flattenQueryResults, executeCompiled, createBulkExecutionContext } from './bulk-context.js';
import { splitIntoChunks, runWithConcurrency, runChunk, maybeTransaction, aggregateOutcomes, aggregateOutcomesWithTimings } from './bulk-utils.js';

interface UpsertExecutorOptions extends BulkExecutorOptions {
  conflictColumns?: string[];
  updateColumns?: string[];
  returning?: boolean | import('../schema/column-types.js').ColumnDef[];
}

const DEFAULT_CHUNK_SIZE = 500;

export class BulkUpsertExecutor extends BulkBaseExecutor<UpsertExecutorOptions> {
  private readonly conflictTargetNodes: ColumnNode[];
  private readonly updateColumns: string[];

  constructor(
    session: OrmSession,
    table: TableDef,
    rows: InsertRow[],
    options: BulkUpsertOptions = {}
  ) {
    super(session, table, rows, { ...options, chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE });

    const pkName = findPrimaryKey(table);
    const conflictTargetNames = options.conflictColumns ?? [pkName];
    this.conflictTargetNodes = conflictTargetNames.map(name => ({
      type: 'Column' as const,
      table: table.name,
      name,
    }));

    const conflictSet = new Set(conflictTargetNames);
    this.updateColumns =
      options.updateColumns ??
      Object.keys(rows[0] ?? {}).filter(col => !conflictSet.has(col) && col in table.columns);
  }

  protected async executeChunk(chunk: InsertRow[], chunkIndex: number): Promise<ChunkOutcome> {
    const returningColumns = resolveReturningColumns(this.ctx, this.table, this.options.returning);

    const set: Record<string, ValueOperandInput> = {};
    for (const col of this.updateColumns) {
      set[col] = { type: 'ExcludedColumn', name: col } as any;
    }

    let builder: InsertQueryBuilder<unknown>;

    if (this.updateColumns.length === 0) {
      builder = new InsertQueryBuilder(this.table).values(chunk).onConflict(this.conflictTargetNodes as any).doNothing();
    } else {
      builder = new InsertQueryBuilder(this.table)
        .values(chunk)
        .onConflict(this.conflictTargetNodes as any)
        .doUpdate(set);
    }

    const finalBuilder = builder as InsertQueryBuilder<unknown>;

    if (returningColumns?.length) {
      finalBuilder.returning(...returningColumns);
    }

    const compiled = finalBuilder.compile(this.ctx.dialect);
    const resultSets = await executeCompiled(this.ctx, compiled);

    return {
      processedRows: chunk.length,
      returning: returningColumns ? flattenQueryResults(resultSets) : [],
      elapsedMs: 0,
    };
  }
}

export async function bulkUpsert<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  rows: InsertRow[],
  options: BulkUpsertOptions = {}
): Promise<import('./bulk-types.js').BulkResult> {
  if (!rows.length) {
    return { processedRows: 0, chunksExecuted: 0, returning: [] };
  }

  const executor = new BulkUpsertExecutor(session, table, rows, options);
  return executor.execute();
}
