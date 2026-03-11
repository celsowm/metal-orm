import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { BulkResult, BulkBaseOptions, ChunkOutcome } from './bulk-types.js';
import { createBulkExecutionContext, type BulkExecutionContext } from './bulk-context.js';
import {
  splitIntoChunks,
  runWithConcurrency,
  runChunk,
  maybeTransaction,
  aggregateOutcomes,
  aggregateOutcomesWithTimings,
} from './bulk-utils.js';

const DEFAULT_CHUNK_SIZE = 500;

export interface BulkExecutorOptions extends BulkBaseOptions {
  chunkSize?: number;
  concurrency?: 'sequential' | number;
  transactional?: boolean;
  timing?: boolean;
  onChunkComplete?: (info: { chunkIndex: number; totalChunks: number; rowsInChunk: number; elapsedMs: number }) => void | Promise<void>;
}

export abstract class BulkBaseExecutor<TOptions extends BulkExecutorOptions> {
  protected readonly session: OrmSession;
  protected readonly table: TableDef;
  protected readonly ctx: BulkExecutionContext;
  protected readonly options: TOptions;
  protected readonly chunks: unknown[][];
  protected readonly totalChunks: number;

  constructor(session: OrmSession, table: TableDef, rows: unknown[], options: TOptions = {} as TOptions) {
    this.session = session;
    this.table = table;
    this.ctx = createBulkExecutionContext(session);
    this.options = {
      chunkSize: DEFAULT_CHUNK_SIZE,
      concurrency: 'sequential',
      transactional: true,
      timing: false,
      ...options,
    } as TOptions;
    this.chunks = splitIntoChunks(rows, this.options.chunkSize!);
    this.totalChunks = this.chunks.length;
  }

  protected abstract executeChunk(chunk: unknown[], chunkIndex: number): Promise<ChunkOutcome>;

  async execute(): Promise<BulkResult> {
    const buildTask = (chunk: unknown[], chunkIndex: number) => async (): Promise<ChunkOutcome> => {
      return runChunk(
        () => this.executeChunk(chunk, chunkIndex),
        chunkIndex,
        this.totalChunks,
        chunk.length,
        this.options.timing!,
        this.options.onChunkComplete
      );
    };

    const tasks = this.chunks.map((chunk, i) => buildTask(chunk, i));

    const outcomes = await maybeTransaction(
      this.session,
      this.options.transactional!,
      () => runWithConcurrency(tasks, this.options.concurrency!)
    );

    return this.options.timing
      ? aggregateOutcomesWithTimings(outcomes)
      : aggregateOutcomes(outcomes);
  }
}
