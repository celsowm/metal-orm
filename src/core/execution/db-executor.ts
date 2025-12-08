// src/core/execution/db-executor.ts

// low-level canonical shape
export type QueryResult = {
  columns: string[];
  values: unknown[][];
};

export interface DbExecutor {
  executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;

  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
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
  const values = rows.map(row => columns.map(c => (row as any)[c]));
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
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
}

/**
 * Generic factory: turn any SimpleQueryRunner into a DbExecutor.
 */
export function createExecutorFromQueryRunner(
  runner: SimpleQueryRunner
): DbExecutor {
  return {
    async executeSql(sql, params) {
      const rows = await runner.query(sql, params);
      const result = rowsToQueryResult(rows);
      return [result];
    },
    beginTransaction: runner.beginTransaction?.bind(runner),
    commitTransaction: runner.commitTransaction?.bind(runner),
    rollbackTransaction: runner.rollbackTransaction?.bind(runner),
  };
}
