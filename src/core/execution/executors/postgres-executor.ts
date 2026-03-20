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

const SAVEPOINT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const sanitizeSavepointName = (name: string): string => {
  const trimmed = name.trim();
  if (!SAVEPOINT_NAME_PATTERN.test(trimmed)) {
    throw new Error(`Invalid savepoint name: "${name}"`);
  }
  return trimmed;
};

/**
 * Creates a database executor for PostgreSQL.
 * @param client A PostgreSQL client or pool instance.
 * @returns A DbExecutor implementation for Postgres.
 */
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
    async savepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      await client.query(`SAVEPOINT ${savepoint}`);
    },
    async releaseSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    },
    async rollbackToSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    },
  });
}
