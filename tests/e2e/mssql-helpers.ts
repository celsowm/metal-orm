import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import type { Connection } from 'tedious';
import { describe } from 'vitest';

import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';

export interface MssqlConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  available: boolean;
}

const parseBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

export function getTestConfigPath(): string {
  return join(tmpdir(), 'metal-orm-mssql-config.json');
}

export function readMssqlConfig(): MssqlConfig {
  const file = process.env.MSSQL_CONFIG_FILE ?? getTestConfigPath();
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf-8')) as MssqlConfig;
  }
  return mssqlConfigFromEnv();
}

export function mssqlConfigFromEnv(): MssqlConfig {
  return {
    host: process.env.MSSQL_HOST ?? 'localhost',
    port: Number(process.env.MSSQL_PORT ?? '11433'),
    username: process.env.MSSQL_USER ?? 'sa',
    password: process.env.MSSQL_PASSWORD ?? 'Iridium12345!',
    database: process.env.MSSQL_DATABASE ?? 'metal_orm_test',
    encrypt: parseBool(process.env.MSSQL_ENCRYPT, false),
    trustServerCertificate: parseBool(process.env.MSSQL_TRUST_CERT, true),
    available: false,
  };
}

export function isMssqlAvailable(): boolean {
  return readMssqlConfig().available;
}

export const describeMssql = (name: string, fn: () => void) => {
  const suite = isMssqlAvailable() ? describe : describe.skip;
  suite(name, fn);
};

export function removeTestConfigFile(): void {
  const file = process.env.MSSQL_CONFIG_FILE ?? getTestConfigPath();
  if (existsSync(file)) {
    try {
      unlinkSync(file);
    } catch {
      // ignore
    }
  }
}

export interface MssqlSetup {
  connection: Connection;
  executor: DbExecutor;
  session: OrmSession;
  config: MssqlConfig;
}

export const createSession = (executor: DbExecutor): OrmSession => {
  const orm = new Orm({
    dialect: new SqlServerDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {},
    },
  });
  return new OrmSession({ orm, executor });
};
