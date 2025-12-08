// src/core/execution/executors/mysql-executor.ts
import {
  DbExecutor,
  rowsToQueryResult
} from '../db-executor.js';

export interface MysqlClientLike {
  query(
    sql: string,
    params?: unknown[]
  ): Promise<[any, any?]>; // rows, metadata
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}

export function createMysqlExecutor(
  client: MysqlClientLike
): DbExecutor {
  return {
    async executeSql(sql, params) {
      const [rows] = await client.query(sql, params as any[]);

      if (!Array.isArray(rows)) {
        // e.g. insert/update returning only headers, treat as no rows
        return [{ columns: [], values: [] }];
      }

      const result = rowsToQueryResult(
        rows as Array<Record<string, unknown>>
      );
      return [result];
    },
    async beginTransaction() {
      if (!client.beginTransaction) return;
      await client.beginTransaction();
    },
    async commitTransaction() {
      if (!client.commit) return;
      await client.commit();
    },
    async rollbackTransaction() {
      if (!client.rollback) return;
      await client.rollback();
    },
  };
}
