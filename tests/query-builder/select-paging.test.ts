import { describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { InterceptorPipeline } from '../../src/orm/interceptor-pipeline.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { selectFrom, update, deleteFrom } from '../../src/query/index.js';
import { eq } from '../../src/core/ast/expression.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const createSession = () => {
  const intercepted: string[] = [];
  const executed: string[] = [];

  const interceptors = new InterceptorPipeline();
  interceptors.use(async (ctx, next) => {
    intercepted.push(ctx.sql);
    return next();
  });

  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql) {
      executed.push(sql);
      if (sql.includes('COUNT(')) {
        return [{ columns: ['total'], values: [[3]] }];
      }
      if (sql.toUpperCase().startsWith('SELECT')) {
        return [{ columns: ['id', 'name'], values: [[1, 'A'], [2, 'B']] }];
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
  return { session, intercepted, executed };
};

describe('SelectQueryBuilder paging helpers', () => {
  it('counts using COUNT(*) via derived table', async () => {
    const { session, intercepted } = createSession();
    const total = await selectFrom(users).select('id').count(session);

    expect(total).toBe(3);
    expect(intercepted.some(sql => sql.includes('COUNT(*)'))).toBe(true);
  });

  it('executes paged query and total count', async () => {
    const { session } = createSession();
    const result = await selectFrom(users).select('id', 'name').executePaged(session, { page: 1, pageSize: 10 });

    expect(result.totalItems).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].name).toBe('A');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});

describe('query execution interceptors', () => {
  it('runs interceptors for SELECT/UPDATE/DELETE', async () => {
    const { session, intercepted } = createSession();

    await selectFrom(users).select('id').execute(session);
    await update(users).set({ name: 'X' }).where(eq(users.columns.id, 1)).execute(session);
    await deleteFrom(users).where(eq(users.columns.id, 1)).execute(session);

    expect(intercepted.length).toBeGreaterThanOrEqual(3);
  });
});

