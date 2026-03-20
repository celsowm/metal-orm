// src/core/execution/db-executor.ts

// low-level canonical shape
export type QueryResult = {
  columns: string[];
  values: unknown[][];
  meta?: {
    insertId?: number | string;
    rowsAffected?: number;
  };
};

/**
 * Canonical execution payload.
 * It remains array-compatible for a gradual migration but always exposes
 * `resultSets` for explicit multi-result handling.
 */
export type ExecutionPayload = QueryResult[] & {
  resultSets?: QueryResult[];
};

export const toExecutionPayload = (resultSets: QueryResult[]): ExecutionPayload => {
  const payload = resultSets as ExecutionPayload;
  payload.resultSets = resultSets;
  return payload;
};

export const payloadResultSets = (payload: ExecutionPayload): QueryResult[] =>
  payload.resultSets ?? payload;

export interface DbExecutor {
  /** Capability flags so the runtime can make correct decisions without relying on optional methods. */
  readonly capabilities: {
    /** True if begin/commit/rollback are real and should be used to provide atomicity. */
    transactions: boolean;
    /** True if savepoint/release/rollback-to-savepoint are implemented. */
    savepoints?: boolean;
  };

  executeSql(sql: string, params?: unknown[]): Promise<ExecutionPayload>;

  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  savepoint?(name: string): Promise<void>;
  releaseSavepoint?(name: string): Promise<void>;
  rollbackToSavepoint?(name: string): Promise<void>;

  /** Release any underlying resources (connections, pool leases, etc). Must be idempotent. */
  dispose(): Promise<void>;
}

// --- helpers ---

/**
 * Convert an array of row objects into a QueryResult.
 */
export function rowsToQueryResult(
  rows: Array<Record<string, unknown>>
): QueryResult {
  if (rows.length === 0) {
    return { columns: [], values: [] };
  }

  const columns = Object.keys(rows[0]);
  const values = rows.map(row => columns.map(c => row[c]));
  return { columns, values };
}

/**
 * Minimal contract that most SQL clients can implement.
 */
export interface SimpleQueryRunner {
  query(
    sql: string,
    params?: unknown[]
  ): Promise<Array<Record<string, unknown>>>;

  /** Optional: used to support real transactions. */
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
  savepoint?(name: string): Promise<void>;
  releaseSavepoint?(name: string): Promise<void>;
  rollbackToSavepoint?(name: string): Promise<void>;

  /** Optional: release resources (connection close, pool lease release, etc). */
  dispose?(): Promise<void>;
}

/**
 * Generic factory: turn any SimpleQueryRunner into a DbExecutor.
 */
export function createExecutorFromQueryRunner(
  runner: SimpleQueryRunner
): DbExecutor {
  const supportsTransactions =
    typeof runner.beginTransaction === 'function' &&
    typeof runner.commitTransaction === 'function' &&
    typeof runner.rollbackTransaction === 'function';
  const supportsSavepoints =
    supportsTransactions &&
    typeof runner.savepoint === 'function' &&
    typeof runner.releaseSavepoint === 'function' &&
    typeof runner.rollbackToSavepoint === 'function';

  return {
    capabilities: {
      transactions: supportsTransactions,
      ...(supportsSavepoints ? { savepoints: true } : {}),
    },
    async executeSql(sql, params) {
      const rows = await runner.query(sql, params);
      const result = rowsToQueryResult(rows);
      return toExecutionPayload([result]);
    },
    async beginTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await runner.beginTransaction!.call(runner);
    },
    async commitTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await runner.commitTransaction!.call(runner);
    },
    async rollbackTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await runner.rollbackTransaction!.call(runner);
    },
    async savepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      await runner.savepoint!.call(runner, name);
    },
    async releaseSavepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      await runner.releaseSavepoint!.call(runner, name);
    },
    async rollbackToSavepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      await runner.rollbackToSavepoint!.call(runner, name);
    },
    async dispose() {
      await runner.dispose?.call(runner);
    },
  };
}
