// src/core/execution/executors/bun-sqlite-executor.ts
import {
  DbExecutor,
  toExecutionPayload,
  rowsToQueryResult,
  QueryResult
} from '../db-executor.js';

export interface BunSqliteStatement {
  columnNames: string[];
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface BunSqliteClientLike {
  prepare(sql: string): BunSqliteStatement;
  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
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
 * Creates a database executor for bun:sqlite.
 * @param client A bun:sqlite database instance.
 * @returns A DbExecutor implementation for bun:sqlite.
 */
export function createBunSqliteExecutor(
  client: BunSqliteClientLike
): DbExecutor {
  return {
    capabilities: {
      transactions: true,
      savepoints: true,
    },
    async executeSql(sql, params) {
      const stmt = client.prepare(sql);
      let result: QueryResult;

      // In bun:sqlite, columnNames is non-empty for SELECT and RETURNING queries.
      if (stmt.columnNames.length > 0) {
        const columns = stmt.columnNames;
        const rows = stmt.all(...(params ?? [])) as Record<string, unknown>[];
        const values = rows.map(row => columns.map(c => row[c]));
        result = { columns, values };
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
      client.run('BEGIN');
    },
    async commitTransaction() {
      client.run('COMMIT');
    },
    async rollbackTransaction() {
      client.run('ROLLBACK');
    },
    async savepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.run(`SAVEPOINT ${savepoint}`);
    },
    async releaseSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.run(`RELEASE SAVEPOINT ${savepoint}`);
    },
    async rollbackToSavepoint(name: string) {
      const savepoint = sanitizeSavepointName(name);
      client.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    },
    async dispose() {
      // Connection lifecycle is owned by the caller.
    },
  };
}
