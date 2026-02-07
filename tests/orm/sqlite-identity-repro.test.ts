import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import sqlite3 from 'sqlite3';

import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { col } from '../../src/schema/column-types.js';
import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
} from '../../src/decorators/index.js';
import { createSqliteExecutor } from '../../src/core/execution/executors/sqlite-executor.js';

@Entity({ tableName: 'repro_identity_test' })
class ReproIdentity {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  name?: string;
}

const execSql = (db: sqlite3.Database, sql: string): Promise<void> =>
  new Promise((resolve, reject) => {
    db.exec(sql, err => (err ? reject(err) : resolve()));
  });

const closeDb = (db: sqlite3.Database): Promise<void> =>
  new Promise((resolve, reject) => {
    db.close(err => (err ? reject(err) : resolve()));
  });

const createSqliteClient = (db: sqlite3.Database) => ({
  all(sql: string, params: unknown[]) {
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
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

describe('SQLite Identity Retrieval Repro', () => {
  let db: sqlite3.Database;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();

    db = new sqlite3.Database(':memory:');

    // Create table for test
    await execSql(db, `
      DROP TABLE IF EXISTS repro_identity_test;
      CREATE TABLE repro_identity_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255)
      );
    `);

    const client = createSqliteClient(db);
    const executor = createSqliteExecutor(client);

    const orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => { },
      },
    });
    session = new OrmSession({ orm, executor });
  });

  afterAll(async () => {
    if (db) {
      try {
        await execSql(db, 'DROP TABLE IF EXISTS repro_identity_test;');
      } catch (e) {
        // ignore
      }
      await closeDb(db);
    }
  });

  it('should automatically populate the ID after flush (expected to fail currently)', async () => {
    const entity = new ReproIdentity();
    entity.name = 'Test Identity';

    await session.persist(entity);
    await session.flush();

    console.log('Entity after flush:', entity);
    
    // This is what the user says is currently undefined
    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });
});
