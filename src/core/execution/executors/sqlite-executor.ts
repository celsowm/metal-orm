// src/core/execution/executors/sqlite-executor.ts
import {
  DbExecutor,
  rowsToQueryResult
} from '../db-executor.js';

export interface SqliteClientLike {
  all(
    sql: string,
    params?: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
  run?(sql: string, params?: unknown[]): Promise<unknown>;
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
}

/**
 * Creates a database executor for SQLite.
 * @param client A SQLite client instance.
 * @returns A DbExecutor implementation for SQLite.
 */
export function createSqliteExecutor(
  client: SqliteClientLike
): DbExecutor {
  const supportsTransactions =
    typeof client.beginTransaction === 'function' &&
    typeof client.commitTransaction === 'function' &&
    typeof client.rollbackTransaction === 'function';

  return {
    capabilities: {
      transactions: supportsTransactions,
    },
    async executeSql(sql, params) {
      const rows = await client.all(sql, params);
      const result = rowsToQueryResult(rows);
      return [result];
    },
    async beginTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await client.beginTransaction!();
    },
    async commitTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await client.commitTransaction!();
    },
    async rollbackTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await client.rollbackTransaction!();
    },
    async dispose() {
      // Connection lifecycle is owned by the caller/driver. Pool lease executors should implement dispose.
    },
  };
}
