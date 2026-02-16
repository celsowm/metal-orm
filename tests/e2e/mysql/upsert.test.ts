import { describe, expect, it } from 'vitest';
import { getSetup } from './helpers.js';

import { col } from '../../../src/schema/column-types.js';
import { defineTable } from '../../../src/schema/table.js';
import { eq } from '../../../src/core/ast/expression.js';
import { insertInto, selectFrom } from '../../../src/query/index.js';
import { executeSchemaSqlFor } from '../../../src/core/ddl/schema-generator.js';
import { MySqlSchemaDialect } from '../../../src/core/ddl/dialects/mysql-schema-dialect.js';

const UpsertUsers = defineTable('upsert_users_mysql_e2e', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(255)),
  name: col.varchar(255)
});

describe('Upsert e2e (mysql)', () => {
  it('updates existing row with onConflict(...).doUpdate(...)', async () => {
    const setup = await getSetup();
    await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), UpsertUsers);

    const firstInsert = insertInto(UpsertUsers)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .compile('mysql');
    await setup.session.executor.executeSql(firstInsert.sql, firstInsert.params);

    const upsert = insertInto(UpsertUsers)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice 2' })
      .onConflict([])
      .doUpdate({ name: 'Alice Updated' })
      .compile('mysql');
    await setup.session.executor.executeSql(upsert.sql, upsert.params);

    const rows = await selectFrom(UpsertUsers)
      .select({
        id: UpsertUsers.columns.id,
        email: UpsertUsers.columns.email,
        name: UpsertUsers.columns.name
      })
      .where(eq(UpsertUsers.columns.id, 1))
      .execute(setup.session);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      email: 'alice@example.com',
      name: 'Alice Updated'
    });
  });

  it('keeps existing row with onConflict(...).doNothing()', async () => {
    const setup = await getSetup();
    await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), UpsertUsers);

    const firstInsert = insertInto(UpsertUsers)
      .values({ id: 2, email: 'bob@example.com', name: 'Bob' })
      .compile('mysql');
    await setup.session.executor.executeSql(firstInsert.sql, firstInsert.params);

    const upsert = insertInto(UpsertUsers)
      .values({ id: 2, email: 'bob@example.com', name: 'Should Be Ignored' })
      .onConflict([])
      .doNothing()
      .compile('mysql');
    await setup.session.executor.executeSql(upsert.sql, upsert.params);

    const rows = await selectFrom(UpsertUsers)
      .select({
        id: UpsertUsers.columns.id,
        email: UpsertUsers.columns.email,
        name: UpsertUsers.columns.name
      })
      .where(eq(UpsertUsers.columns.id, 2))
      .execute(setup.session);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 2,
      email: 'bob@example.com',
      name: 'Bob'
    });
  });
});
