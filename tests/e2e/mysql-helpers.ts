import mysql from 'mysql2/promise';

import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import {
  createMysqlExecutor,
  type MysqlClientLike
} from '../../src/core/execution/executors/mysql-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { createDB } from 'mysql-memory-server';

const parseEnvBoolean = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

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

export interface MysqlTestSetup {
  db: any;
  connection: mysql.Connection;
  session: OrmSession;
}

export const createMysqlServer = async (): Promise<MysqlTestSetup> => {
  const downloadBinaryOnce = parseEnvBoolean(process.env.MYSQL_MEMORY_SERVER_DOWNLOAD_BINARY_ONCE);
  const db = await createDB({
    logLevel: process.env.MYSQL_MEMORY_SERVER_LOG_LEVEL as any || 'ERROR',
    version: process.env.MYSQL_MEMORY_SERVER_VERSION,
    downloadBinaryOnce
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

export const resetMysqlSchema = async (connection: mysql.Connection): Promise<void> => {
  const tables = await queryAll<Record<string, unknown>>(
    connection,
    'SELECT table_name AS table_name FROM information_schema.tables WHERE table_schema = DATABASE();'
  );
  if (!tables.length) return;

  await runSql(connection, 'SET FOREIGN_KEY_CHECKS = 0;');
  for (const row of tables) {
    const value = row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0];
    if (typeof value !== 'string' || value.length === 0) continue;
    await runSql(connection, `DROP TABLE IF EXISTS \`${value}\`;`);
  }
  await runSql(connection, 'SET FOREIGN_KEY_CHECKS = 1;');
};
