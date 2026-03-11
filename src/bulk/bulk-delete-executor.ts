import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { and, inList } from '../core/ast/expression-builders.js';
import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { BulkDeleteOptions, ChunkOutcome } from './bulk-types.js';
import type { ValueOperandInput } from '../core/ast/expression.js';
import type { ExpressionNode } from '../core/ast/expression-nodes.js';
import { BulkBaseExecutor, type BulkExecutorOptions } from './bulk-executor.base.js';
import { createBulkExecutionContext, executeCompiled } from './bulk-context.js';
import { splitIntoChunks, runWithConcurrency, runChunk, maybeTransaction, aggregateOutcomes, aggregateOutcomesWithTimings } from './bulk-utils.js';

const DEFAULT_CHUNK_SIZE = 1000;

interface DeleteExecutorOptions extends BulkExecutorOptions {
  by?: string;
  where?: ExpressionNode;
}

export class BulkDeleteExecutor extends BulkBaseExecutor<DeleteExecutorOptions> {
  private readonly byColumnName: string;

  constructor(
    session: OrmSession,
    table: TableDef,
    ids: ValueOperandInput[],
    options: BulkDeleteOptions = {}
  ) {
    super(session, table, ids, options);
    this.byColumnName = options.by ?? findPrimaryKey(table);
  }

  protected async executeChunk(chunk: ValueOperandInput[], chunkIndex: number): Promise<ChunkOutcome> {
    const byColumn = this.table.columns[this.byColumnName];
    if (!byColumn) {
      throw new Error(
        `bulkDelete: column "${this.byColumnName}" not found in table "${this.table.name}"`
      );
    }

    const extraWhere = this.options.where;
    const inExpr = inList(byColumn, chunk as any);
    const finalWhere = extraWhere ? and(inExpr, extraWhere) : inExpr;

    const builder = new DeleteQueryBuilder(this.table).where(finalWhere as ExpressionNode);
    const compiled = builder.compile(this.ctx.dialect);
    await executeCompiled(this.ctx, compiled);

    return {
      processedRows: chunk.length,
      returning: [],
      elapsedMs: 0,
    };
  }
}

export async function bulkDelete<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  ids: ValueOperandInput[],
  options: BulkDeleteOptions = {}
): Promise<import('./bulk-types.js').BulkResult> {
  if (!ids.length) {
    return { processedRows: 0, chunksExecuted: 0, returning: [] };
  }

  const executor = new BulkDeleteExecutor(session, table, ids, options);
  return executor.execute();
}

export async function bulkDeleteWhere<TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  where: ExpressionNode,
  options: Pick<BulkDeleteOptions, 'transactional'> = {}
): Promise<import('./bulk-types.js').BulkResult> {
  const { transactional = false } = options;

  const ctx = createBulkExecutionContext(session);
  const builder = new DeleteQueryBuilder(table).where(where);
  const compiled = builder.compile(ctx.dialect);

  const execute = async (): Promise<import('./bulk-types.js').BulkResult> => {
    await executeCompiled(ctx, compiled);
    return { processedRows: 0, chunksExecuted: 1, returning: [] };
  };

  return maybeTransaction(session, transactional, execute);
}
