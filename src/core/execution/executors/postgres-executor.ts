// src/core/execution/executors/postgres-executor.ts
import {
  DbExecutor,
  createExecutorFromQueryRunner
} from '../db-executor.js';

export interface PostgresClientLike {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function createPostgresExecutor(
  client: PostgresClientLike
): DbExecutor {
  return createExecutorFromQueryRunner({
    async query(sql, params) {
      const { rows } = await client.query(sql, params);
      return rows;
    },
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commitTransaction() {
      await client.query('COMMIT');
    },
    async rollbackTransaction() {
      await client.query('ROLLBACK');
    },
  });
}
