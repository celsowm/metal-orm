import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { OrmSession } from '../../src/orm/orm-session.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import type { TableDef } from '../../src/schema/table.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb
} from './sqlite-helpers.ts';

@Entity({ tableName: 'persons' })
class Person {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @HasMany({ target: () => Task, foreignKey: 'personId' })
  tasks!: HasManyCollection<Task>;
}

@Entity()
class Task {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.notNull(col.int()))
  personId!: number;
}

describe('SelectQueryBuilder.firstOrFail (sqlite)', () => {
  let db: sqlite3.Database;
  let session: OrmSession;
  let personTable: TableDef;
  let taskTable: TableDef;

  const run = (sql: string, params: unknown[] = []): Promise<void> =>
    new Promise((resolve, reject) => {
      db.run(sql, params, err => (err ? reject(err) : resolve()));
    });

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    bootstrapEntities();
    personTable = getTableDefFromEntity(Person)!;
    taskTable = getTableDefFromEntity(Task)!;

    session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(
      session.executor,
      new SQLiteSchemaDialect(),
      personTable,
      taskTable
    );

    await run('INSERT INTO persons (id, name) VALUES (?, ?)', [1, 'Alice']);
    await run('INSERT INTO persons (id, name) VALUES (?, ?)', [2, 'Bob']);
    await run('INSERT INTO tasks (id, title, personId) VALUES (?, ?, ?)', [1, 'Task A', 1]);
    await run('INSERT INTO tasks (id, title, personId) VALUES (?, ?, ?)', [2, 'Task B', 1]);
  });

  afterAll(async () => {
    await closeDb(db);
  });

  it('returns the entity when a matching record exists', async () => {
    const person = await selectFromEntity(Person)
      .where(eq(personTable.columns.name, 'Alice'))
      .firstOrFail(session);

    expect(person).toBeDefined();
    expect(person.name).toBe('Alice');
  });

  it('throws when no record matches', async () => {
    await expect(
      selectFromEntity(Person)
        .where(eq(personTable.columns.name, 'NonExistent'))
        .firstOrFail(session)
    ).rejects.toThrow('No results found');
  });

  it('returns only one record when multiple match', async () => {
    const person = await selectFromEntity(Person)
      .firstOrFail(session);

    expect(person).toBeDefined();
    expect(person.id).toBeDefined();
    expect(typeof person.name).toBe('string');
  });

  it('works with include (loads relations)', async () => {
    const person = await selectFromEntity(Person)
      .include('tasks')
      .where(eq(personTable.columns.name, 'Alice'))
      .firstOrFail(session);

    expect(person.name).toBe('Alice');
    const tasks = await person.tasks.load();
    expect(tasks).toHaveLength(2);
  });

  it('throws on empty table', async () => {
    const emptyDb = new sqlite3.Database(':memory:');
    const emptySession = createSqliteSessionFromDb(emptyDb);
    await executeSchemaSqlFor(
      emptySession.executor,
      new SQLiteSchemaDialect(),
      personTable
    );

    await expect(
      selectFromEntity(Person).firstOrFail(emptySession)
    ).rejects.toThrow('No results found');

    await closeDb(emptyDb);
  });

  it('respects orderBy (returns first by given order)', async () => {
    const person = await selectFromEntity(Person)
      .orderBy(personTable.columns.id, 'DESC')
      .firstOrFail(session);

    expect(person.name).toBe('Bob');
  });

  it('firstOrFailPlain returns a plain object (not entity instance)', async () => {
    const person = await selectFromEntity(Person)
      .where(eq(personTable.columns.name, 'Alice'))
      .firstOrFailPlain(session);

    expect(person).toBeDefined();
    expect(person.name).toBe('Alice');
    expect(person).not.toBeInstanceOf(Person);
  });

  it('firstOrFailPlain throws when no record matches', async () => {
    await expect(
      selectFromEntity(Person)
        .where(eq(personTable.columns.name, 'NonExistent'))
        .firstOrFailPlain(session)
    ).rejects.toThrow('No results found');
  });

  it('does not mutate the original builder', async () => {
    const qb = selectFromEntity(Person)
      .where(eq(personTable.columns.name, 'Alice'));

    await qb.firstOrFail(session);

    const all = await qb.execute(session);
    expect(all).toHaveLength(1);
  });
});
