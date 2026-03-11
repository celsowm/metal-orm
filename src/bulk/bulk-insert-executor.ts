import { InsertQueryBuilder, ConflictBuilder } from '../query-builder/insert.js';
import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { BulkInsertOptions, ChunkOutcome, InsertRow } from './bulk-types.js';
import { BulkBaseExecutor, type BulkExecutorOptions } from './bulk-executor.base.js';
import { resolveReturningColumns, flattenQueryResults, executeCompiled } from './bulk-context.js';

interface InsertExecutorOptions extends BulkExecutorOptions {
  returning?: boolean | import('../schema/column-types.js').ColumnDef[];
  onConflict?: import('../core/ast/query.js').UpsertClause;
}

export class BulkInsertExecutor extends BulkBaseExecutor<InsertExecutorOptions> {
  constructor(
    session: OrmSession,
    table: TableDef,
    rows: InsertRow[],
    options: BulkInsertOptions = {}
  ) {
    super(session, table, rows, options);
  }

  protected async executeChunk(chunk: InsertRow[], chunkIndex: number): Promise<ChunkOutcome> {
    const returningColumns = resolveReturningColumns(this.ctx, this.table, this.options.returning);

    let builder: InsertQueryBuilder<unknown> | ConflictBuilder<unknown> = 
      new InsertQueryBuilder(this.table).values(chunk);

    if (this.options.onConflict) {
      const conflictColumns = this.options.onConflict.target?.columns ?? [];
      builder = (builder as InsertQueryBuilder<unknown>).onConflict(conflictColumns as any);
      
      if (this.options.onConflict.action.type === 'DoNothing') {
        builder = (builder as ConflictBuilder<unknown>).doNothing();
      } else if (this.options.onConflict.action.type === 'DoUpdate' && this.options.onConflict.action.set) {
        const setMap: Record<string, unknown> = {};
        for (const assignment of this.options.onConflict.action.set) {
          const colName = typeof assignment.column === 'object' ? assignment.column.name : assignment.column;
          setMap[colName] = assignment.value;
        }
        builder = (builder as ConflictBuilder<unknown>).doUpdate(setMap as any);
      }
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

export async function bulkInsert<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  rows: InsertRow[],
  options: BulkInsertOptions = {}
): Promise<import('./bulk-types.js').BulkResult> {
  if (!rows.length) {
    return { processedRows: 0, chunksExecuted: 0, returning: [] };
  }

  const executor = new BulkInsertExecutor(session, table, rows, options);
  return executor.execute();
}
