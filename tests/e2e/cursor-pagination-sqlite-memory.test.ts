import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { selectFrom } from '../../src/query/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { closeDb, createSqliteSessionFromDb, runSql } from './sqlite-helpers.ts';

const Items = defineTable('cursor_items', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  score: col.int()
});

describe('Cursor pagination e2e (sqlite memory)', () => {
  const seedItems = async (db: sqlite3.Database, count: number) => {
    for (let i = 1; i <= count; i++) {
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [
        i,
        `Item ${String(i).padStart(2, '0')}`,
        (count - i + 1) * 10
      ]);
    }
  };

  it('paginates forward through all results (single column orderBy)', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 7);

      // Page 1
      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3 });

      expect(page1.items).toHaveLength(3);
      expect(page1.items.map((r: any) => r.id)).toEqual([1, 2, 3]);
      expect(page1.pageInfo.hasNextPage).toBe(true);
      expect(page1.pageInfo.hasPreviousPage).toBe(false);
      expect(page1.pageInfo.startCursor).toBeTruthy();
      expect(page1.pageInfo.endCursor).toBeTruthy();

      // Page 2
      const page2 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3, after: page1.pageInfo.endCursor! });

      expect(page2.items.map((r: any) => r.id)).toEqual([4, 5, 6]);
      expect(page2.pageInfo.hasNextPage).toBe(true);
      expect(page2.pageInfo.hasPreviousPage).toBe(true);

      // Page 3 (last)
      const page3 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3, after: page2.pageInfo.endCursor! });

      expect(page3.items.map((r: any) => r.id)).toEqual([7]);
      expect(page3.pageInfo.hasNextPage).toBe(false);
      expect(page3.pageInfo.hasPreviousPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('paginates with DESC order', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 5);

      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.id, 'DESC')
        .executeCursor(session, { first: 2 });

      expect(page1.items.map((r: any) => r.id)).toEqual([5, 4]);
      expect(page1.pageInfo.hasNextPage).toBe(true);

      const page2 = await selectFrom(Items)
        .orderBy(Items.columns.id, 'DESC')
        .executeCursor(session, { first: 2, after: page1.pageInfo.endCursor! });

      expect(page2.items.map((r: any) => r.id)).toEqual([3, 2]);
      expect(page2.pageInfo.hasNextPage).toBe(true);

      const page3 = await selectFrom(Items)
        .orderBy(Items.columns.id, 'DESC')
        .executeCursor(session, { first: 2, after: page2.pageInfo.endCursor! });

      expect(page3.items.map((r: any) => r.id)).toEqual([1]);
      expect(page3.pageInfo.hasNextPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('paginates backward through all results (single column orderBy)', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 7);

      const anchor = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 4 });

      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { last: 3, before: anchor.pageInfo.endCursor! });

      expect(page1.items.map((r: any) => r.id)).toEqual([1, 2, 3]);
      expect(page1.pageInfo.hasPreviousPage).toBe(false);
      expect(page1.pageInfo.hasNextPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('paginates backward with DESC order', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 5);

      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.id, 'DESC')
        .executeCursor(session, { first: 4 });

      const prev = await selectFrom(Items)
        .orderBy(Items.columns.id, 'DESC')
        .executeCursor(session, { last: 2, before: page1.pageInfo.endCursor! });

      expect(prev.items.map((r: any) => r.id)).toEqual([4, 3]);
      expect(prev.pageInfo.hasPreviousPage).toBe(true);
      expect(prev.pageInfo.hasNextPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('paginates with multi-column orderBy (score DESC, id ASC)', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      // Insert items with duplicate scores to test multi-column keyset
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [1, 'A', 100]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [2, 'B', 100]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [3, 'C', 90]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [4, 'D', 90]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [5, 'E', 80]);

      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.score, 'DESC')
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 2 });

      // score DESC, id ASC → (100,1), (100,2), (90,3), (90,4), (80,5)
      expect(page1.items.map((r: any) => r.id)).toEqual([1, 2]);
      expect(page1.pageInfo.hasNextPage).toBe(true);

      const page2 = await selectFrom(Items)
        .orderBy(Items.columns.score, 'DESC')
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 2, after: page1.pageInfo.endCursor! });

      expect(page2.items.map((r: any) => r.id)).toEqual([3, 4]);

      const page3 = await selectFrom(Items)
        .orderBy(Items.columns.score, 'DESC')
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 2, after: page2.pageInfo.endCursor! });

      expect(page3.items.map((r: any) => r.id)).toEqual([5]);
      expect(page3.pageInfo.hasNextPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('paginates backward with multi-column orderBy (score DESC, id ASC)', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [1, 'A', 100]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [2, 'B', 100]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [3, 'C', 90]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [4, 'D', 90]);
      await runSql(db, `INSERT INTO ${Items.name} (id, name, score) VALUES (?, ?, ?)`, [5, 'E', 80]);

      const anchor = await selectFrom(Items)
        .orderBy(Items.columns.score, 'DESC')
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 4 });

      const prev = await selectFrom(Items)
        .orderBy(Items.columns.score, 'DESC')
        .orderBy(Items.columns.id)
        .executeCursor(session, { last: 2, before: anchor.pageInfo.endCursor! });

      expect(prev.items.map((r: any) => r.id)).toEqual([2, 3]);
      expect(prev.pageInfo.hasPreviousPage).toBe(true);
      expect(prev.pageInfo.hasNextPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('returns empty result when no data', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);

      const result = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.pageInfo.startCursor).toBeNull();
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('exact page size does not produce false hasNextPage', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 3);

      const result = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.pageInfo.hasNextPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('supports paging backward from a middle window', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 7);

      const page1 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3 });

      const page2 = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 3, after: page1.pageInfo.endCursor! });

      const prev = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { last: 3, before: page2.pageInfo.startCursor! });

      expect(prev.items.map((r: any) => r.id)).toEqual([1, 2, 3]);
      expect(prev.pageInfo.hasPreviousPage).toBe(false);
      expect(prev.pageInfo.hasNextPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('exact backward page size does not produce false hasPreviousPage', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 4);

      const anchor = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 4 });

      const result = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { last: 3, before: anchor.pageInfo.endCursor! });

      expect(result.items).toHaveLength(3);
      expect(result.items.map((r: any) => r.id)).toEqual([1, 2, 3]);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
      expect(result.pageInfo.hasNextPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('empty backward result returns null cursors and false flags', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Items);
      await seedItems(db, 3);

      const cursor = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { first: 1 });

      const result = await selectFrom(Items)
        .orderBy(Items.columns.id)
        .executeCursor(session, { last: 2, before: cursor.pageInfo.startCursor! });

      expect(result.items).toHaveLength(0);
      expect(result.pageInfo.startCursor).toBeNull();
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });
});
