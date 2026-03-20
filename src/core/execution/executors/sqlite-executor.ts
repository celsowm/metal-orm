// src/core/execution/executors/sqlite-executor.ts
import {
  DbExecutor,
  toExecutionPayload,
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
  savepoint?(name: string): Promise<void>;
  releaseSavepoint?(name: string): Promise<void>;
  rollbackToSavepoint?(name: string): Promise<void>;
}

const SAVEPOINT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const sanitizeSavepointName = (name: string): string => {
  const trimmed = name.trim();
  if (!SAVEPOINT_NAME_PATTERN.test(trimmed)) {
    throw new Error(`Invalid savepoint name: "${name}"`);
  }
  return trimmed;
};

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
  const supportsSavepoints = supportsTransactions;

  const executeControlStatement = async (sql: string): Promise<void> => {
    if (typeof client.run === 'function') {
      await client.run(sql);
      return;
    }
    await client.all(sql);
  };

  return {
    capabilities: {
      transactions: supportsTransactions,
      ...(supportsSavepoints ? { savepoints: true } : {}),
    },
    async executeSql(sql, params) {
      const rows = await client.all(sql, params);
      const result = rowsToQueryResult(rows);
      return toExecutionPayload([result]);
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
    async savepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      const savepoint = sanitizeSavepointName(name);
      if (typeof client.savepoint === 'function') {
        await client.savepoint(savepoint);
        return;
      }
      await executeControlStatement(`SAVEPOINT ${savepoint}`);
    },
    async releaseSavepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      const savepoint = sanitizeSavepointName(name);
      if (typeof client.releaseSavepoint === 'function') {
        await client.releaseSavepoint(savepoint);
        return;
      }
      await executeControlStatement(`RELEASE SAVEPOINT ${savepoint}`);
    },
    async rollbackToSavepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      const savepoint = sanitizeSavepointName(name);
      if (typeof client.rollbackToSavepoint === 'function') {
        await client.rollbackToSavepoint(savepoint);
        return;
      }
      await executeControlStatement(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    },
    async dispose() {
      // Connection lifecycle is owned by the caller/driver. Pool lease executors should implement dispose.
    },
  };
}
