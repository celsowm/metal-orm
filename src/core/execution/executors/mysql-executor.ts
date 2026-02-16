// src/core/execution/executors/mysql-executor.ts
import {
  DbExecutor,
  QueryResult,
  toExecutionPayload,
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

type RowObject = Record<string, unknown>;

const isRowObject = (value: unknown): value is RowObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRowObjectArray = (value: unknown): value is RowObject[] =>
  Array.isArray(value) && value.every(isRowObject);

const isMysqlResultHeader = (value: unknown): value is Record<string, unknown> =>
  isRowObject(value) &&
  ('affectedRows' in value ||
    'insertId' in value ||
    'warningStatus' in value ||
    'serverStatus' in value);

const headerToQueryResult = (header: Record<string, unknown>): QueryResult => ({
  columns: [],
  values: [],
  meta: {
    insertId: header.insertId as number | string | undefined,
    rowsAffected: header.affectedRows as number | undefined,
  }
});

const normalizeMysqlResults = (rows: unknown): QueryResult[] => {
  if (!Array.isArray(rows)) {
    return isMysqlResultHeader(rows)
      ? [headerToQueryResult(rows)]
      : [rowsToQueryResult([])];
  }

  if (isRowObjectArray(rows)) {
    return [rowsToQueryResult(rows)];
  }

  const normalized: QueryResult[] = [];
  for (const chunk of rows) {
    if (isRowObjectArray(chunk)) {
      normalized.push(rowsToQueryResult(chunk));
      continue;
    }
    if (isMysqlResultHeader(chunk)) {
      normalized.push(headerToQueryResult(chunk));
    }
  }

  return normalized.length ? normalized : [rowsToQueryResult([])];
};

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
      return toExecutionPayload(normalizeMysqlResults(rows));
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
