import { describe, expect, it } from 'vitest';

import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { insertInto, selectFrom } from '../../src/query/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { PostgresSchemaDialect } from '../../src/core/ddl/dialects/postgres-schema-dialect.js';
import { createPgliteServer, runSql, stopPgliteServer } from './pglite-helpers.js';

const UpsertUsers = defineTable('upsert_users_pg_e2e', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(255)),
  name: col.varchar(255)
});

const ConstraintUsers = defineTable('upsert_users_pg_constraint_e2e', {
  id: col.primaryKey(col.int()),
  email: col.varchar(255),
  name: col.varchar(255)
});

describe('Upsert e2e (pglite / postgres)', () => {
  it('updates existing row with onConflict(...).doUpdate(...)', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), UpsertUsers);

      const firstInsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('postgres');
      await setup.session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice 2' })
        .onConflict([UpsertUsers.columns.id])
        .doUpdate({ name: 'Alice Updated' })
        .compile('postgres');
      await setup.session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(UpsertUsers)
        .select({
          id: UpsertUsers.columns.id,
          email: UpsertUsers.columns.email,
          name: UpsertUsers.columns.name
        })
        .execute(setup.session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice Updated'
      });
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('keeps existing row with onConflict(...).doNothing()', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), UpsertUsers);

      const firstInsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('postgres');
      await setup.session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(UpsertUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Should Be Ignored' })
        .onConflict([UpsertUsers.columns.id])
        .doNothing()
        .compile('postgres');
      await setup.session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(UpsertUsers)
        .select({
          id: UpsertUsers.columns.id,
          email: UpsertUsers.columns.email,
          name: UpsertUsers.columns.name
        })
        .execute(setup.session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice'
      });
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('supports onConflict([], constraint).doNothing() with named constraint', async () => {
    const setup = await createPgliteServer();

    try {
      await runSql(
        setup.db,
        [
          'CREATE TABLE upsert_users_pg_constraint_e2e (',
          '  id integer primary key,',
          '  email varchar(255) not null,',
          '  name varchar(255) not null,',
          '  CONSTRAINT upsert_users_pg_constraint_e2e_email_key UNIQUE (email)',
          ');'
        ].join('\n')
      );

      const firstInsert = insertInto(ConstraintUsers)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('postgres');
      await setup.session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(ConstraintUsers)
        .values({ id: 2, email: 'alice@example.com', name: 'Should Be Ignored' })
        .onConflict([], 'upsert_users_pg_constraint_e2e_email_key')
        .doNothing()
        .compile('postgres');
      await setup.session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(ConstraintUsers)
        .select({
          id: ConstraintUsers.columns.id,
          email: ConstraintUsers.columns.email,
          name: ConstraintUsers.columns.name
        })
        .execute(setup.session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice'
      });
    } finally {
      await stopPgliteServer(setup);
    }
  });
});
