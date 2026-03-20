// src/core/execution/executors/mssql-executor.ts
import {
  DbExecutor,
  toExecutionPayload,
  rowsToQueryResult
} from '../db-executor.js';

export interface MssqlClientLike {
  query(
    sql: string,
    params?: unknown[]
  ): Promise<{
    recordset?: Array<Record<string, unknown>>;
    recordsets?: Array<Array<Record<string, unknown>>>;
  }>;
  beginTransaction?(): Promise<void>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
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
 * Creates a database executor for Microsoft SQL Server.
 * @param client A SQL Server client instance.
 * @returns A DbExecutor implementation for MSSQL.
 */
export function createMssqlExecutor(
  client: MssqlClientLike
): DbExecutor {
  const supportsTransactions =
    typeof client.beginTransaction === 'function' &&
    typeof client.commit === 'function' &&
    typeof client.rollback === 'function';
  const supportsSavepoints = supportsTransactions;

  return {
    capabilities: {
      transactions: supportsTransactions,
      ...(supportsSavepoints ? { savepoints: true } : {}),
    },
    async executeSql(sql, params) {
      const { recordset, recordsets } = await client.query(sql, params);
      const sets = Array.isArray(recordsets) ? recordsets : [recordset ?? []];
      return toExecutionPayload(sets.map(set => rowsToQueryResult(set ?? [])));
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
    async savepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      const savepoint = sanitizeSavepointName(name);
      await client.query(`SAVE TRANSACTION ${savepoint}`);
    },
    async releaseSavepoint(_name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      // SQL Server does not expose a RELEASE SAVEPOINT statement.
    },
    async rollbackToSavepoint(name: string) {
      if (!supportsSavepoints) {
        throw new Error('Savepoints are not supported by this executor');
      }
      const savepoint = sanitizeSavepointName(name);
      await client.query(`ROLLBACK TRANSACTION ${savepoint}`);
    },
    async dispose() {
      // Connection lifecycle is owned by the caller/driver. Pool lease executors should implement dispose.
    },
  };
}

// ---------------------------------------------------------------------------
// Tedious integration helper (driver adapter)
// ---------------------------------------------------------------------------

export interface TediousColumn {
  metadata: { colName: string };
  value: unknown;
}

export interface TediousRequest {
  addParameter(name: string, type: unknown, value: unknown): void;
  on(event: 'row', listener: (columns: TediousColumn[]) => void): void;
}

export interface TediousRequestCtor {
  new(sql: string, callback: (err?: Error | null) => void): TediousRequest;
}

export interface TediousTypes {
  NVarChar: unknown;
  Int: unknown;
  Float: unknown;
  BigInt: unknown;
  Bit: unknown;
  DateTime: unknown;
  VarBinary: unknown;
}

export interface TediousModule {
  Request: TediousRequestCtor;
  TYPES: TediousTypes;
}

export interface TediousConnectionLike {
  execSql(request: TediousRequest): void;
  beginTransaction?(cb: (err?: Error | null) => void): void;
  commitTransaction?(cb: (err?: Error | null) => void): void;
  rollbackTransaction?(cb: (err?: Error | null) => void): void;
}

export interface CreateTediousClientOptions {
  inferType?(value: unknown, TYPES: TediousTypes): unknown;
}

const defaultInferType = (value: unknown, TYPES: TediousTypes): unknown => {
  if (value === null || value === undefined) return TYPES.NVarChar;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TYPES.Int : TYPES.Float;
  }
  if (typeof value === 'bigint') return TYPES.BigInt;
  if (typeof value === 'boolean') return TYPES.Bit;
  if (value instanceof Date) return TYPES.DateTime;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return TYPES.VarBinary;
  }
  return TYPES.NVarChar;
};

export function createTediousMssqlClient(
  connection: TediousConnectionLike,
  { Request, TYPES }: TediousModule,
  options?: CreateTediousClientOptions
): MssqlClientLike {
  const inferType = options?.inferType ?? defaultInferType;

  return {
    async query(sql: string, params: unknown[] = []) {
      const rows = await new Promise<Array<Record<string, unknown>>>(
        (resolve, reject) => {
          const collected: Record<string, unknown>[] = [];

          const request = new Request(sql, err => {
            if (err) return reject(err);
            resolve(collected);
          });

          params.forEach((value, idx) => {
            const sqlType = inferType(value, TYPES);
            request.addParameter(
              `p${idx + 1}`,
              sqlType,
              value as unknown
            );
          });

          request.on('row', cols => {
            const row: Record<string, unknown> = {};
            for (const col of cols) {
              row[col.metadata.colName] = col.value;
            }
            collected.push(row);
          });

          connection.execSql(request);
        }
      );

      return { recordset: rows, recordsets: [rows] };
    },

    beginTransaction: connection.beginTransaction
      ? () =>
        new Promise<void>((resolve, reject) => {
          connection.beginTransaction!(err =>
            err ? reject(err) : resolve()
          );
        })
      : undefined,

    commit: connection.commitTransaction
      ? () =>
        new Promise<void>((resolve, reject) => {
          connection.commitTransaction!(err =>
            err ? reject(err) : resolve()
          );
        })
      : undefined,

    rollback: connection.rollbackTransaction
      ? () =>
        new Promise<void>((resolve, reject) => {
          connection.rollbackTransaction!(err =>
            err ? reject(err) : resolve()
          );
        })
      : undefined,
  };
}

export function createTediousExecutor(
  connection: TediousConnectionLike,
  module: TediousModule,
  options?: CreateTediousClientOptions
): DbExecutor {
  const client = createTediousMssqlClient(connection, module, options);
  return createMssqlExecutor(client);
}
