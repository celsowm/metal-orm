import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column.js';
import { gt, count, eq } from '../src/core/ast/expression.js';
import { Orm } from '../src/orm/orm.js';
import { OrmSession } from '../src/orm/orm-session.js';
import { QueryResult, DbExecutor } from '../src/core/execution/db-executor.js';

// Define test schema
const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const UsersWithOrderCount = defineTable(
  'users',
  {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    order_count: col.int(),
  },
  {},
);

const Orders = defineTable('orders', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  total: col.int(),
});

const createMockExecutor = (responses: QueryResult[][]): {
  executor: DbExecutor;
  executed: Array<{ sql: string; params?: unknown[] }>;
} => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];
  let callIndex = 0;
  const executor: DbExecutor = {
    async executeSql(sql, params) {
      executed.push({ sql, params });
      const result = responses[callIndex] ?? [];
      callIndex += 1;
      return result;
    }
  };
  return { executor, executed };
};

const createSession = (dialect: SqliteDialect, executor: DbExecutor): OrmSession => {
  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor
  };
  const orm = new Orm({
    dialect,
    executorFactory: factory
  });
  return new OrmSession({ orm, executor });
};

describe('Pagination with HAVING clause', () => {
  it('should generate correct SQL for a paginated query with a HAVING clause', async () => {
    const pageSize = 5;
    const page = 2;
    const offset = (page - 1) * pageSize;

    const builder = new SelectQueryBuilder(UsersWithOrderCount)
      .select({
        id: UsersWithOrderCount.columns.id,
        order_count: count(Orders.columns.id),
      })
      .innerJoin(Orders, eq(Orders.columns.user_id, Users.columns.id))
      .groupBy(UsersWithOrderCount.columns.id)
      .having(gt(count(Orders.columns.id), 2))
      .orderBy(UsersWithOrderCount.columns.id, 'ASC')
      .limit(pageSize)
      .offset(offset);

    const sqlite = new SqliteDialect();
    let compiled = builder.compile(sqlite);

    // Assert SQL generation
    const havingIndex = compiled.sql.indexOf('HAVING');
    const limitIndex = compiled.sql.indexOf('LIMIT');
    const offsetIndex = compiled.sql.indexOf('OFFSET');

    expect(havingIndex).toBeGreaterThan(-1);
    expect(limitIndex).toBeGreaterThan(havingIndex);
    expect(offsetIndex).toBeGreaterThan(limitIndex);
    expect(compiled.sql).toContain('COUNT("orders"."id") > ?');
    expect(compiled.sql).toContain(`LIMIT ${pageSize}`);
    expect(compiled.sql).toContain(`OFFSET ${offset}`);
    expect(compiled.params).toEqual([2]);

    // Mock data and assert hydration
    const response: QueryResult = {
      columns: ['id', 'order_count'],
      values: [
        [6, 3],
        [7, 4],
        [8, 3],
        [9, 5],
        [10, 3],
      ],
    };

    const { executor } = createMockExecutor([[response]]);
    const session = createSession(sqlite, executor);
    const ast = builder.getAST();
    compiled = session.orm.dialect.compileSelect(ast);
    const result = await session.executor.executeSql(compiled.sql, compiled.params);
    const results = result[0].values;

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual([6, 3]);
    expect(results[4]).toEqual([10, 3]);
  });
});
