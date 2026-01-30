import mysql from 'mysql2/promise';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, readdirSync, unlinkSync, statSync } from 'fs';

import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import {
  createMysqlExecutor,
  type MysqlClientLike
} from '../../src/core/execution/executors/mysql-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { createDB } from 'mysql-memory-server';

const createMysqlClient = (connection: mysql.Connection): MysqlClientLike => ({
  async query(sql, params) {
    const [rows] = await connection.execute(sql, params ?? []);
    return [rows, undefined];
  },
  async beginTransaction() {
    await connection.beginTransaction();
  },
  async commit() {
    await connection.commit();
  },
  async rollback() {
    await connection.rollback();
  }
});

export const createMysqlExecutorFromConnection = (connection: mysql.Connection) =>
  createMysqlExecutor(createMysqlClient(connection));

export const createSession = (executor: DbExecutor): OrmSession => {
  const orm = new Orm({
    dialect: new MySqlDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    }
  });

  return new OrmSession({ orm, executor });
};

export const createMysqlSessionFromConnection = (
  connection: mysql.Connection
): OrmSession => {
  const executor = createMysqlExecutorFromConnection(connection);
  return createSession(executor);
};

export function getTestConfigPath() {
  return join(tmpdir(), 'metal-orm-mysql-config.json');
}

export interface MysqlTestSetup {
  db: any;
  connection: mysql.Connection;
  session: OrmSession;
}


export function cleanupStaleLocks(maxAgeMs = 60000) {
  const binariesDir = join(tmpdir(), 'mysqlmsn', 'binaries');
  if (!existsSync(binariesDir)) return;

  try {
    const files = readdirSync(binariesDir);
    const now = Date.now();

    for (const file of files) {
      if (file.endsWith('.lock')) {
        const lockPath = join(binariesDir, file);
        try {
          const stats = statSync(lockPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            console.log(`🧹 Removing stale lock file: ${file} (age: ${Math.round(age / 1000)}s)`);
            unlinkSync(lockPath);
          }
        } catch (e) {
          // ignore stat/unlink errors (e.g. if another process just deleted it)
        }
      }
    }
  } catch (err) {
    // ignore readdir errors
  }
}

export const createMysqlServer = async (): Promise<MysqlTestSetup> => {
  cleanupStaleLocks();

  const db = await createDB({
    logLevel: process.env.MYSQL_MEMORY_SERVER_LOG_LEVEL as any || 'ERROR',
    version: '9.5.0',
  });

  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: db.username,
    port: db.port,
    database: db.dbName,
    password: ''
  });
  const session = createMysqlSessionFromConnection(connection);

  return { db, connection, session };
};

export const createMysqlServerFromEnv = async (): Promise<MysqlTestSetup> => {
  const url = process.env.MYSQL_TEST_URL;
  if (!url) {
    throw new Error('MYSQL_TEST_URL environment variable is not set. Example: mysql://root:password@localhost:3306/test_db');
  }

  const connection = await mysql.createConnection(url);
  const session = createMysqlSessionFromConnection(connection);

  return { db: null, connection, session };
};

export const stopMysqlServer = async (setup: MysqlTestSetup): Promise<void> => {
  await setup.connection.end();
  if (setup.db) {
    await setup.db.stop();
  }
};

export const runSql = async (
  connection: mysql.Connection,
  sql: string,
  params: unknown[] = []
): Promise<void> => {
  await connection.execute(sql, params);
};

export const queryAll = async <T extends Record<string, unknown>>(
  connection: mysql.Connection,
  sql: string,
  params: unknown[] = []
): Promise<T[]> => {
  const [rows] = await connection.execute(sql, params);
  return rows as T[];
};
