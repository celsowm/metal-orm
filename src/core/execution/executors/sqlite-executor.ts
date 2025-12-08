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

export function createSqliteExecutor(
  client: SqliteClientLike
): DbExecutor {
  return {
    async executeSql(sql, params) {
      const rows = await client.all(sql, params);
      const result = rowsToQueryResult(rows);
      return [result];
    },
    beginTransaction: client.beginTransaction?.bind(client),
    commitTransaction: client.commitTransaction?.bind(client),
    rollbackTransaction: client.rollbackTransaction?.bind(client),
  };
}
