import { describe, expect, it } from 'vitest';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { hasMany } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { PostgresSchemaDialect } from '../../src/core/ddl/dialects/postgres-schema-dialect.js';
import { createPgliteServer, runSql, stopPgliteServer } from './pglite-helpers.js';

const Users = defineTable('count_users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255)
});

const Posts = defineTable('count_posts', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  title: col.varchar(255)
});

setRelations(Users, {
  posts: hasMany(Posts, 'user_id')
});

describe('Count pagination e2e (pglite)', () => {
  const seed = async (db: Awaited<ReturnType<typeof createPgliteServer>>['db']) => {
    await runSql(db, `INSERT INTO ${Users.name} (id, name) VALUES ($1, $2)`, [1, 'Alice']);
    await runSql(db, `INSERT INTO ${Users.name} (id, name) VALUES ($1, $2)`, [2, 'Bob']);

    await runSql(db, `INSERT INTO ${Posts.name} (id, user_id, title) VALUES ($1, $2, $3)`, [1, 1, 'P1']);
    await runSql(db, `INSERT INTO ${Posts.name} (id, user_id, title) VALUES ($1, $2, $3)`, [2, 1, 'P2']);
    await runSql(db, `INSERT INTO ${Posts.name} (id, user_id, title) VALUES ($1, $2, $3)`, [3, 1, 'P3']);
    await runSql(db, `INSERT INTO ${Posts.name} (id, user_id, title) VALUES ($1, $2, $3)`, [4, 2, 'P4']);
  };

  it('counts distinct roots vs joined rows with include()', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Users, Posts);
      await seed(setup.db);

      const query = selectFrom(Users)
        .include('posts', { columns: ['id'] })
        .where(eq(Users.columns.id, 1))
        .orderBy(Users.columns.id);

      const distinctCount = await query.count(setup.session);
      const rowCount = await query.countRows(setup.session);

      expect(distinctCount).toBe(1);
      expect(rowCount).toBe(3);
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('executePaged uses distinct count for totalItems', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Users, Posts);
      await seed(setup.db);

      const query = selectFrom(Users)
        .include('posts', { columns: ['id'] })
        .where(eq(Users.columns.id, 1))
        .orderBy(Users.columns.id);

      const result = await query.executePaged(setup.session, { page: 1, pageSize: 10 });

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
    } finally {
      await stopPgliteServer(setup);
    }
  });
});

