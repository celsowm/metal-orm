// src/core/execution/executors/mssql-executor.ts
import {
  DbExecutor,
  rowsToQueryResult
} from '../db-executor.js';

export interface MssqlClientLike {
  query(
    sql: string,
    params?: unknown[]
  ): Promise<{ recordset: Array<Record<string, unknown>> }>;
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}

export function createMssqlExecutor(
  client: MssqlClientLike
): DbExecutor {
  return {
    async executeSql(sql, params) {
      const { recordset } = await client.query(sql, params);
      const result = rowsToQueryResult(recordset ?? []);
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
