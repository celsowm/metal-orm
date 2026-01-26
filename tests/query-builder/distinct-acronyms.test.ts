import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { Orm, OrmSession, SqliteDialect, createSqliteExecutor, bootstrapEntities, selectFromEntity, Entity, Column, entityRef, getTableDefFromEntity, insertInto } from '../../src/index.ts';
import Database from 'sqlite3';

describe('Distinct acronyms query', () => {
  let db: Database.Database;
  let orm: Orm;
  let session: OrmSession;

  @Entity()
  class Organization {
    @Column({ primary: true, type: 'integer' })
    id!: number;

    @Column({ type: 'text' })
    acronym!: string;

    @Column({ type: 'text' })
    fullName!: string;
  }

  const O = entityRef(Organization);

  beforeEach(async () => {
    // Set up in-memory SQLite database
    db = new Database.Database(':memory:');

    // Create promise-based wrapper for sqlite3
    const executor = createSqliteExecutor({
      all: (sql: string, params?: any[]) =>
        new Promise<Record<string, unknown>[]>((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as Record<string, unknown>[]);
          });
        }),
      run: (sql: string, params?: any[]) =>
        new Promise<{ lastID: number, changes: number }>((resolve, reject) => {
          db.run(sql, params, function (this: any, err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
          });
        })
    });

    // Bootstrap entities
    bootstrapEntities();

    // Create ORM instance
    orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => { },
      },
    });

    session = new OrmSession({ orm, executor });

    // Create table structure using direct database execution (kept as before)
    await new Promise<void>((resolve, reject) => {
      db.exec(`
        CREATE TABLE organizations (
          id INTEGER PRIMARY KEY,
          acronym TEXT,
          fullName TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Seed data with duplicate acronyms using MetalORM's insert
    const insertOrgs = insertInto(Organization).values([
      { acronym: 'NASA', fullName: 'National Aeronautics and Space Administration' },
      { acronym: 'UN', fullName: 'United Nations' },
      { acronym: 'NASA', fullName: 'National Aeronautical and Space Agency' },
      { acronym: 'WHO', fullName: 'World Health Organization' },
      { acronym: 'UN', fullName: 'Universal Network' }
    ]);
    const { sql, params } = insertOrgs.compile(new SqliteDialect());
    await session.executor.executeSql(sql, params);
  });

  afterEach(async () => {
    db.close();
  });

  it('should return distinct acronyms', async () => {
    const result = await selectFromEntity(Organization)
      .select('acronym')
      .distinct(O.acronym)
      .orderBy(O.acronym, 'ASC')
      .execute(session);

    // Should have 3 distinct acronyms: NASA, UN, WHO
    expect(result).toHaveLength(3);
    expect(result.map(r => r.acronym)).toEqual(['NASA', 'UN', 'WHO']);
  });
});