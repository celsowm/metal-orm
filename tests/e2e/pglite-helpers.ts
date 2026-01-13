import { PGlite } from '@electric-sql/pglite';

import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { createPostgresExecutor, type PostgresClientLike } from '../../src/core/execution/executors/postgres-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';

const createPgliteClient = (db: PGlite): PostgresClientLike => ({
  async query(sql, params) {
    return await db.query(sql, params);
  }
});

export const createPgliteExecutor = (db: PGlite) =>
  createPostgresExecutor(createPgliteClient(db));

export const createSession = (executor: DbExecutor): OrmSession => {
  const orm = new Orm({
    dialect: new PostgresDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    }
  });

  return new OrmSession({ orm, executor });
};

export const createPgliteSessionFromDb = (db: PGlite): OrmSession => {
  const executor = createPgliteExecutor(db);
  return createSession(executor);
};

export interface PgliteTestSetup {
  db: PGlite;
  session: OrmSession;
}

let sharedDb: PGlite | null = null;
let sharedSession: OrmSession | null = null;

export const createPgliteServer = async (): Promise<PgliteTestSetup> => {
  if (sharedDb && sharedSession) {
    return { db: sharedDb, session: sharedSession };
  }
  
  const db = new PGlite();
  const session = createPgliteSessionFromDb(db);
  
  sharedDb = db;
  sharedSession = session;

  return { db, session };
};

export const stopPgliteServer = async (setup: PgliteTestSetup): Promise<void> => {
  if (sharedDb) {
    await sharedDb.close();
    sharedDb = null;
    sharedSession = null;
  }
};

export const runSql = async (
  db: PGlite,
  sql: string,
  params: unknown[] = []
): Promise<void> => {
  await db.query(sql, params);
};

export const queryAll = async <T extends Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = []
): Promise<T[]> => {
  const result = await db.query(sql, params);
  return result.rows as T[];
};
