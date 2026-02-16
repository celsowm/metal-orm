import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { insertInto, selectFrom } from '../../src/query/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { closeDb, createSqliteSessionFromDb } from './sqlite-helpers.ts';

const UpsertUsers = defineTable('upsert_users_sqlite_e2e', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(255)),
  name: col.varchar(255)
});

describe('Upsert e2e (sqlite memory)', () => {
  it('updates existing row with onConflict(...).doUpdate(...)', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), UpsertUsers);

      const firstInsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('sqlite');
      await session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice 2' })
        .onConflict([UpsertUsers.columns.id])
        .doUpdate({ name: 'Alice Updated' })
        .compile('sqlite');
      await session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(UpsertUsers)
        .select({
          id: UpsertUsers.columns.id,
          email: UpsertUsers.columns.email,
          name: UpsertUsers.columns.name
        })
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice Updated'
      });
    } finally {
      await closeDb(db);
    }
  });

  it('keeps existing row with onConflict(...).doNothing()', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), UpsertUsers);

      const firstInsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('sqlite');
      await session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Should Be Ignored' })
        .onConflict([UpsertUsers.columns.id])
        .doNothing()
        .compile('sqlite');
      await session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(UpsertUsers)
        .select({
          id: UpsertUsers.columns.id,
          email: UpsertUsers.columns.email,
          name: UpsertUsers.columns.name
        })
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice'
      });
    } finally {
      await closeDb(db);
    }
  });
});
