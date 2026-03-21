// tests/e2e/better-sqlite3-memory.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { Orm } from '../../src/orm/orm.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { createBetterSqlite3Executor } from '../../src/core/execution/executors/better-sqlite3-executor.js';
import { defineTable, col, type InferRow, insertInto, selectFrom, update, deleteFrom, eq, tableRef } from '../../src/index.js';

const usersTable = defineTable('users', {
  id: col.autoIncrement(col.primaryKey(col.int())),
  name: col.text(),
  age: col.int()
});

const t = tableRef(usersTable);

type User = InferRow<typeof usersTable>;

describe('better-sqlite3 E2E (In-Memory)', () => {
  let db: Database.Database;
  let orm: Orm;

  beforeAll(() => {
    db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)').run();

    const executor = createBetterSqlite3Executor(db);
    orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => { db.close(); }
      }
    });
  });

  beforeEach(() => {
    db.prepare('DELETE FROM users').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name='users'").run();
  });

  afterAll(async () => {
    await orm.dispose();
  });

  it('can perform CRUD operations', async () => {
    const session = orm.createSession();

    // INSERT
    const insertStmt = insertInto(usersTable).values({ name: 'Alice', age: 30 });
    const insertCompiled = insertStmt.compile(orm.dialect);
    const [insertResult] = await session.executor.executeSql(insertCompiled.sql, insertCompiled.params);
    expect(insertResult.meta?.insertId).toBe(1);

    // SELECT
    const users = await selectFrom(usersTable).where(eq(t.id, 1)).execute(session);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ name: 'Alice', age: 30 });

    // UPDATE
    const updateStmt = update(usersTable).set({ age: 31 }).where(eq(t.id, 1));
    const updateCompiled = updateStmt.compile(orm.dialect);
    await session.executor.executeSql(updateCompiled.sql, updateCompiled.params);

    // Clear session identity map to force reload
    session.identityMap.clear();

    const [updatedUser] = await selectFrom(usersTable).where(eq(t.id, 1)).execute(session);
    expect(updatedUser.age).toBe(31);

    // DELETE
    const deleteStmt = deleteFrom(usersTable).where(eq(t.id, 1));
    const deleteCompiled = deleteStmt.compile(orm.dialect);
    await session.executor.executeSql(deleteCompiled.sql, deleteCompiled.params);

    session.identityMap.clear();

    const remainingUsers = await selectFrom(usersTable).execute(session);
    expect(remainingUsers).toHaveLength(0);
  });

  it('handles transactions correctly', async () => {
    await orm.transaction(async (session) => {
        const i1 = insertInto(usersTable).values({ name: 'Bob', age: 25 }).compile(orm.dialect);
        await session.executor.executeSql(i1.sql, i1.params);
        const i2 = insertInto(usersTable).values({ name: 'Charlie', age: 35 }).compile(orm.dialect);
        await session.executor.executeSql(i2.sql, i2.params);
    });

    const session = orm.createSession();
    const users = await selectFrom(usersTable).execute(session);
    expect(users).toHaveLength(2);

    // Rollback scenario
    try {
      await orm.transaction(async (session) => {
        const i3 = insertInto(usersTable).values({ name: 'Dave', age: 40 }).compile(orm.dialect);
        await session.executor.executeSql(i3.sql, i3.params);
        throw new Error('Force rollback');
      });
    } catch (e) {
      // Expected
    }

    const usersAfterRollback = await selectFrom(usersTable).execute(session);
    expect(usersAfterRollback).toHaveLength(2);
    expect(usersAfterRollback.map(u => u.name)).not.toContain('Dave');
  });

  it('handles savepoints correctly', async () => {
    const session = orm.createSession();

    await session.executor.beginTransaction();
    const i1 = insertInto(usersTable).values({ name: 'Eve', age: 22 }).compile(orm.dialect);
    await session.executor.executeSql(i1.sql, i1.params);

    await session.executor.savepoint!('sp1');
    const i2 = insertInto(usersTable).values({ name: 'Frank', age: 28 }).compile(orm.dialect);
    await session.executor.executeSql(i2.sql, i2.params);

    const usersWithFrank = await selectFrom(usersTable).execute(session);
    expect(usersWithFrank.map(u => u.name)).toContain('Frank');

    await session.executor.rollbackToSavepoint!('sp1');

    session.identityMap.clear();

    const usersAfterRollbackToSP = await selectFrom(usersTable).execute(session);
    expect(usersAfterRollbackToSP.map(u => u.name)).not.toContain('Frank');
    expect(usersAfterRollbackToSP.map(u => u.name)).toContain('Eve');

    await session.executor.commitTransaction();
  });
});
