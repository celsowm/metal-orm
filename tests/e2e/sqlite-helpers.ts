import sqlite3 from 'sqlite3';

import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import {
  createSqliteExecutor,
  type SqliteClientLike
} from '../../src/core/execution/executors/sqlite-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';

export const execSql = (db: sqlite3.Database, sql: string): Promise<void> =>
  new Promise((resolve, reject) => {
    db.exec(sql, err => (err ? reject(err) : resolve()));
  });

export const runSql = (
  db: sqlite3.Database,
  sql: string,
  params: unknown[]
): Promise<void> =>
  new Promise((resolve, reject) => {
    db.run(sql, params, err => (err ? reject(err) : resolve()));
  });

export const closeDb = (db: sqlite3.Database): Promise<void> =>
  new Promise((resolve, reject) => {
    db.close(err => (err ? reject(err) : resolve()));
  });

export const createSqliteClient = (db: sqlite3.Database): SqliteClientLike => ({
  all(sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params ?? [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows as Record<string, unknown>[]);
      });
    });
  }
});

export const createSqliteExecutorFromDb = (db: sqlite3.Database) =>
  createSqliteExecutor(createSqliteClient(db));

export const createSession = (executor: DbExecutor): OrmSession => {
  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    }
  });

  return new OrmSession({ orm, executor });
};

export const createSqliteSessionFromDb = (db: sqlite3.Database): OrmSession => {
  const executor = createSqliteExecutorFromDb(db);
  return createSession(executor);
};
