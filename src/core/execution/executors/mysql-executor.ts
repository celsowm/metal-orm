// src/core/execution/executors/mysql-executor.ts
import {
  DbExecutor,
  rowsToQueryResult
} from '../db-executor.js';

export interface MysqlClientLike {
  query(
    sql: string,
    params?: unknown[]
  ): Promise<[unknown, unknown?]>; // rows, metadata
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}

/**
 * Creates a database executor for MySQL.
 * @param client A MySQL client instance.
 * @returns A DbExecutor implementation for MySQL.
 */
export function createMysqlExecutor(
  client: MysqlClientLike
): DbExecutor {
  const supportsTransactions =
    typeof client.beginTransaction === 'function' &&
    typeof client.commit === 'function' &&
    typeof client.rollback === 'function';

  return {
    capabilities: {
      transactions: supportsTransactions,
    },
    async executeSql(sql, params) {
      const [rows] = await client.query(sql, params);

      if (!Array.isArray(rows)) {
        const header = rows as Record<string, unknown>;
        return [{
          columns: [],
          values: [],
          meta: {
            insertId: header.insertId as number | undefined,
            rowsAffected: header.affectedRows as number | undefined,
          }
        }];
      }

      const result = rowsToQueryResult(
        rows as Array<Record<string, unknown>>
      );
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
      await client.commit!();
    },
    async rollbackTransaction() {
      if (!supportsTransactions) {
        throw new Error('Transactions are not supported by this executor');
      }
      await client.rollback!();
    },
    async dispose() {
      // Connection lifecycle is owned by the caller/driver. Pool lease executors should implement dispose.
    },
  };
}
