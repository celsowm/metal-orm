// src/core/execution/executors/better-sqlite3-executor.ts
import {
  DbExecutor,
  toExecutionPayload,
  rowsToQueryResult,
  QueryResult
} from '../db-executor.js';

export interface BetterSqlite3Statement {
  reader: boolean;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface BetterSqlite3ClientLike {
  prepare(sql: string): BetterSqlite3Statement;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
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
 * Creates a database executor for better-sqlite3.
 * @param client A better-sqlite3 database instance.
 * @returns A DbExecutor implementation for better-sqlite3.
 */
export function createBetterSqlite3Executor(
  client: BetterSqlite3ClientLike
): DbExecutor {
  // better-sqlite3 handles nested transactions using savepoints automatically
  // when using .transaction(), but DbExecutor needs explicit control.

  return {
    capabilities: {
      transactions: true,
      savepoints: true,
    },
    async executeSql(sql, params) {
      const stmt = client.prepare(sql);
      let result: QueryResult;

      if (stmt.reader) {
        const rows = stmt.all(...(params ?? [])) as Record<string, unknown>[];
        result = rowsToQueryResult(rows);
      } else {
        const info = stmt.run(...(params ?? []));
        result = {
          columns: [],
          values: [],
          meta: {
            rowsAffected: info.changes,
            insertId: typeof info.lastInsertRowid === 'bigint'
              ? info.lastInsertRowid.toString()
              : info.lastInsertRowid
          }
        };
      }

      return toExecutionPayload([result]);
    },
    async beginTransaction() {
      client.prepare('BEGIN').run();
    },
    async commitTransaction() {
      client.prepare('COMMIT').run();
    },
    async rollbackTransaction() {
      client.prepare('ROLLBACK').run();
    },
    async savepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.prepare(`SAVEPOINT ${savepoint}`).run();
    },
    async releaseSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.prepare(`RELEASE SAVEPOINT ${savepoint}`).run();
    },
    async rollbackToSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.prepare(`ROLLBACK TO SAVEPOINT ${savepoint}`).run();
    },
    async dispose() {
      // Connection lifecycle is owned by the caller.
    },
  };
}
