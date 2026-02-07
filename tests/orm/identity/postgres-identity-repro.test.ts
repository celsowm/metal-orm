import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { Orm } from '../../../src/orm/orm.js';
import { OrmSession } from '../../../src/orm/orm-session.js';
import { col } from '../../../src/schema/column-types.js';
import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
} from '../../../src/decorators/index.js';
import { createPostgresExecutor, type PostgresClientLike } from '../../../src/core/execution/executors/postgres-executor.js';

@Entity({ tableName: 'repro_identity_test' })
class ReproIdentity {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  name?: string;
}

const createPgliteClient = (db: PGlite): PostgresClientLike => ({
  async query(sql, params) {
    return await db.query(sql, params);
  }
});

const createPgliteExecutor = (db: PGlite) =>
  createPostgresExecutor(createPgliteClient(db));

describe('PostgreSQL Identity Retrieval Repro', () => {
  let db: PGlite;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();

    db = new PGlite();

    // Create table for test
    await db.query('DROP TABLE IF EXISTS repro_identity_test;');
    await db.query(`
      CREATE TABLE repro_identity_test (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255)
      );
    `);

    const executor = createPgliteExecutor(db);

    const orm = new Orm({
      dialect: new PostgresDialect(),
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
        await db.query('DROP TABLE IF EXISTS repro_identity_test;');
      } catch (e) {
        // ignore
      }
      await db.close();
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
