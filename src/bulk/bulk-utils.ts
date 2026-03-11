import type { BulkConcurrency, ChunkOutcome, ChunkCompleteInfo, BulkResult } from './bulk-types.js';

export function splitIntoChunks<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new RangeError(`chunkSize must be >= 1, got ${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type Task<T> = () => Promise<T>;

export async function runWithConcurrency<T>(
  tasks: Task<T>[],
  concurrency: BulkConcurrency
): Promise<T[]> {
  const limit = concurrency === 'sequential' ? 1 : Math.max(1, concurrency);

  if (limit === 1) {
    const results: T[] = [];
    for (const task of tasks) {
      results.push(await task());
    }
    return results;
  }

  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  };

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function runChunk<T>(
  task: Task<T>,
  chunkIndex: number,
  totalChunks: number,
  rowsInChunk: number,
  timing: boolean,
  onChunkComplete?: (info: ChunkCompleteInfo) => void | Promise<void>
): Promise<T> {
  const start = timing || onChunkComplete ? Date.now() : 0;
  const result = await task();
  const elapsedMs = start ? Date.now() - start : 0;

  if (onChunkComplete) {
    await onChunkComplete({ chunkIndex, totalChunks, rowsInChunk, elapsedMs });
  }

  return result;
}

export async function maybeTransaction<T>(
  session: unknown,
  transactional: boolean,
  fn: () => Promise<T>
): Promise<T> {
  if (!transactional) return fn();
  const ormSession = session as { transaction: (fn: () => Promise<T>) => Promise<T> };
  return ormSession.transaction(fn);
}

export function aggregateOutcomes(outcomes: ChunkOutcome[]): BulkResult {
  const result: BulkResult = {
    processedRows: 0,
    chunksExecuted: outcomes.length,
    returning: [],
  };

  for (const o of outcomes) {
    result.processedRows += o.processedRows;
    result.returning.push(...o.returning);
  }

  return result;
}

export function aggregateOutcomesWithTimings(outcomes: ChunkOutcome[]): BulkResult {
  const result = aggregateOutcomes(outcomes);
  result.chunkTimings = outcomes.map(o => o.elapsedMs);
  return result;
}
