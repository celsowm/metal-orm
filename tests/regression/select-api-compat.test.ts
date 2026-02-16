import { describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import type { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import { InterceptorPipeline } from '../../src/orm/interceptor-pipeline.js';
import { selectFrom } from '../../src/query/index.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const createSession = () => {
  const interceptedSql: string[] = [];
  const executedSql: string[] = [];

  const interceptor = new InterceptorPipeline();
  interceptor.use(async (ctx, next) => {
    interceptedSql.push(ctx.sql);
    return next();
  });

  const responses: QueryResult[][] = [
    [{ columns: ['id', 'name'], values: [[1, 'Alice'], [2, 'Bob']] }],
    [{ columns: ['total'], values: [[2]] }],
    [{ columns: ['id', 'name'], values: [[1, 'Alice'], [2, 'Bob']] }],
  ];

  let callIndex = 0;
  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql: string): Promise<QueryResult[]> {
      executedSql.push(sql);
      const result = responses[callIndex] ?? [{ columns: [], values: [] }];
      callIndex += 1;
      return result;
    },
    beginTransaction: async () => { },
    commitTransaction: async () => { },
    rollbackTransaction: async () => { },
    dispose: async () => { },
  };

  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    },
    interceptors: interceptor
  });

  return {
    session: new OrmSession({ orm, executor }),
    interceptedSql,
    executedSql
  };
};

describe('SELECT API compatibility regression', () => {
  it('preserves execute(session), count(session) and executePaged(session, { page, pageSize })', async () => {
    const { session, interceptedSql } = createSession();
    const qb = selectFrom(users).select('id', 'name');

    const rows = await qb.execute(session);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, name: 'Alice' });

    const paged = await qb.executePaged(session, { page: 1, pageSize: 2 });
    expect(paged).toEqual({
      items: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      totalItems: 2,
      page: 1,
      pageSize: 2
    });

    expect(interceptedSql.length).toBe(3);
    expect(interceptedSql[0]).toContain('SELECT');
    expect(interceptedSql[1]).toContain('COUNT(*)');
    expect(interceptedSql[2]).toContain('LIMIT 2');
  });
});
