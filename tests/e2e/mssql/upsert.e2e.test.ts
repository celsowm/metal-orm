import { beforeAll, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { col } from '../../../src/schema/column-types.js';
import { defineTable } from '../../../src/schema/table.js';
import { insertInto, selectFrom } from '../../../src/query/index.js';
import { eq } from '../../../src/core/ast/expression.js';

const randomTempTableName = (): string =>
  `##upsert_mssql_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

describeMssql('Upsert e2e (mssql temp table)', () => {
  let session: Awaited<ReturnType<typeof getSetup>>['session'];
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];

  beforeAll(async () => {
    ({ session, executor } = await getSetup());
  });

  it('updates existing row with onConflict(...).doUpdate(...)', async () => {
    const tableName = randomTempTableName();
    const users = defineTable(tableName, {
      id: col.primaryKey(col.int()),
      email: col.unique(col.varchar(255)),
      name: col.varchar(255)
    });

    try {
      await executor.executeSql(`
        CREATE TABLE [${tableName}] (
          [id] INT NOT NULL PRIMARY KEY,
          [email] NVARCHAR(255) NOT NULL UNIQUE,
          [name] NVARCHAR(255) NOT NULL
        );
      `);

      const firstInsert = insertInto(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('mssql');
      await executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice 2' })
        .onConflict([users.columns.id])
        .doUpdate({ name: 'Alice Updated' })
        .compile('mssql');
      await executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(users)
        .select({
          id: users.columns.id,
          email: users.columns.email,
          name: users.columns.name
        })
        .where(eq(users.columns.id, 1))
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice Updated'
      });
    } finally {
      await executor.executeSql(`IF OBJECT_ID('tempdb..${tableName}') IS NOT NULL DROP TABLE [${tableName}];`);
    }
  });

  it('keeps existing row with onConflict(...).doNothing()', async () => {
    const tableName = randomTempTableName();
    const users = defineTable(tableName, {
      id: col.primaryKey(col.int()),
      email: col.unique(col.varchar(255)),
      name: col.varchar(255)
    });

    try {
      await executor.executeSql(`
        CREATE TABLE [${tableName}] (
          [id] INT NOT NULL PRIMARY KEY,
          [email] NVARCHAR(255) NOT NULL UNIQUE,
          [name] NVARCHAR(255) NOT NULL
        );
      `);

      const firstInsert = insertInto(users)
        .values({ id: 2, email: 'bob@example.com', name: 'Bob' })
        .compile('mssql');
      await executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(users)
        .values({ id: 2, email: 'bob@example.com', name: 'Should Be Ignored' })
        .onConflict([users.columns.id])
        .doNothing()
        .compile('mssql');
      await executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(users)
        .select({
          id: users.columns.id,
          email: users.columns.email,
          name: users.columns.name
        })
        .where(eq(users.columns.id, 2))
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 2,
        email: 'bob@example.com',
        name: 'Bob'
      });
    } finally {
      await executor.executeSql(`IF OBJECT_ID('tempdb..${tableName}') IS NOT NULL DROP TABLE [${tableName}];`);
    }
  });
});
