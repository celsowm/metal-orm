import { describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { InterceptorPipeline } from '../../src/orm/interceptor-pipeline.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { hasMany } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  title: col.varchar(255),
});

users.relations = {
  posts: hasMany(posts, 'user_id')
};

const createSession = () => {
  const intercepted: string[] = [];

  const interceptors = new InterceptorPipeline();
  interceptors.use(async (ctx, next) => {
    intercepted.push(ctx.sql);
    return next();
  });

  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql) {
      // It doesn't matter which number we return for this unit test: we assert on the SQL shape.
      if (sql.toUpperCase().includes('COUNT(')) {
        return [{ columns: ['total'], values: [[123]] }];
      }
      return [{ columns: [], values: [] }];
    },
    beginTransaction: async () => { },
    commitTransaction: async () => { },
    rollbackTransaction: async () => { },
    dispose: async () => { },
  };

  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => { }
  };

  const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: factory, interceptors });
  const session = new OrmSession({ orm, executor });
  return { session, intercepted };
};

describe('SelectQueryBuilder.count()', () => {
  it('counts distinct root PKs when relations are eager-loaded (prevents join multiplication)', async () => {
    const { session, intercepted } = createSession();
    const total = await selectFrom(users)
      .include('posts')
      .count(session);

    expect(total).toBe(123);

    const sql = intercepted.find(s => s.toUpperCase().includes('COUNT('));
    expect(sql).toBeTruthy();

    const upper = sql!.toUpperCase();
    expect(upper).toContain('SELECT COUNT(*)');
    expect(upper).toContain('SELECT DISTINCT');
    expect(sql).toContain('"users"."id"');
  });

  it('uses the root alias when counting distinct PKs', async () => {
    const { session, intercepted } = createSession();
    await selectFrom(users)
      .as('u')
      .include('posts')
      .count(session);

    const sql = intercepted.find(s => s.toUpperCase().includes('COUNT('));
    expect(sql).toBeTruthy();
    expect(sql).toContain('"u"."id"');
  });

  it('countRows() keeps legacy behavior (no DISTINCT on root PK)', async () => {
    const { session, intercepted } = createSession();
    await selectFrom(users)
      .include('posts')
      .countRows(session);

    const sql = intercepted.find(s => s.toUpperCase().includes('COUNT('));
    expect(sql).toBeTruthy();

    const upper = sql!.toUpperCase();
    expect(upper).toContain('SELECT COUNT(*)');
    expect(upper).not.toContain('SELECT DISTINCT');
  });
});
