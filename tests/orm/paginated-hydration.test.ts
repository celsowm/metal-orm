import { describe, expect, it } from 'vitest';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { QueryResult, DbExecutor } from '../../src/core/execution/db-executor.js';
import { HasManyCollection } from '../../src/schema/types.js';
import { Users } from '../fixtures/schema.js';
import { makeRelationAlias } from '../../src/query-builder/relation-alias.js';

const createMockExecutor = (responses: QueryResult[][]): {
  executor: DbExecutor;
  executed: Array<{ sql: string; params?: unknown[] }>;
} => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];
  let callIndex = 0;
  const executor: DbExecutor = {
    capabilities: { transactions: true },
    async executeSql(sql, params) {
      executed.push({ sql, params });
      const result = responses[callIndex] ?? [];
      callIndex += 1;
      return result;
    },
    beginTransaction: async () => { },
    commitTransaction: async () => { },
    rollbackTransaction: async () => { },
    dispose: async () => { },
  };
  return { executor, executed };
};

const createSession = (dialect: SqliteDialect, executor: DbExecutor): OrmSession => {
  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => { }
  };
  const orm = new Orm({
    dialect,
    executorFactory: factory
  });
  return new OrmSession({ orm, executor });
};

describe('Paginated has-many hydration', () => {
  it('hydrates a paginated 1:N include using a single SQL query', async () => {
    const builder = new SelectQueryBuilder(Users)
      .include('orders', {
        columns: ['id', 'user_id', 'total', 'status']
      })
      .orderBy(Users.columns.id, 'ASC')
      .limit(1);

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();
    const hydrationPlan = plan!;
    const relation = hydrationPlan.relations.find(rel => rel.name === 'orders');
    expect(relation).toBeDefined();
    const relationPlan = relation!;

    const rootColumns = hydrationPlan.rootColumns.includes(hydrationPlan.rootPrimaryKey)
      ? [...hydrationPlan.rootColumns]
      : [...hydrationPlan.rootColumns, hydrationPlan.rootPrimaryKey];

    const relationColumns = relationPlan.columns.map(col =>
      makeRelationAlias(relationPlan.aliasPrefix, col)
    );

    const columns = [...rootColumns, ...relationColumns];

    const baseRow = rootColumns.reduce<Record<string, any>>((values, column) => {
      if (column === hydrationPlan.rootPrimaryKey) {
        values[column] = 1;
      } else if (column === 'settings') {
        values[column] = '{}';
      } else if (column === 'deleted_at') {
        values[column] = null;
      } else {
        values[column] = `user-${column}`;
      }
      return values;
    }, {});

    const orderFixtures: Array<Record<string, any>> = [
      { id: 10, user_id: 1, total: 100, status: 'open' },
      { id: 11, user_id: 1, total: 220, status: 'shipped' }
    ];

    const rows = orderFixtures.map(order => {
      const row: Record<string, any> = { ...baseRow };
      for (const column of relationPlan.columns) {
        const alias = makeRelationAlias(relationPlan.aliasPrefix, column);
        row[alias] = order[column];
      }
      return row;
    });

    const response: QueryResult = {
      columns,
      values: rows.map(row => columns.map(col => row[col]))
    };

    const { executor, executed } = createMockExecutor([[response]]);
    const session = createSession(new SqliteDialect(), executor);

    const users = await builder.execute(session);
    expect(users).toHaveLength(1);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('LIMIT 1');

    const user = users[0];
    expect(user.id).toBe(1);

    const ordersRelation = user.orders as HasManyCollection<any>;
    const orders = await ordersRelation.load();
    expect(orders).toHaveLength(2);
    expect(orders.map(order => order.total)).toEqual([100, 220]);
    expect(orders.map(order => order.status)).toEqual(['open', 'shipped']);
    expect(executed).toHaveLength(1);
  });

  it('paginates 10-per-page with an eager has-many include and reports the real parent count', async () => {
    const pageSize = 10;
    const totalParents = 30;
    const totalPages = Math.ceil(totalParents / pageSize);

    const builder = new SelectQueryBuilder(Users)
      .include('orders', {
        columns: ['id', 'user_id', 'total', 'status']
      })
      .orderBy(Users.columns.id, 'ASC')
      .limit(pageSize);

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();
    const hydrationPlan = plan!;
    const relation = hydrationPlan.relations.find(rel => rel.name === 'orders');
    expect(relation).toBeDefined();
    const relationPlan = relation!;

    const rootColumns = hydrationPlan.rootColumns.includes(hydrationPlan.rootPrimaryKey)
      ? [...hydrationPlan.rootColumns]
      : [...hydrationPlan.rootColumns, hydrationPlan.rootPrimaryKey];

    const relationColumns = relationPlan.columns.map(col =>
      makeRelationAlias(relationPlan.aliasPrefix, col)
    );

    const columns = [...rootColumns, ...relationColumns];

    const buildRootRow = (id: number) =>
      rootColumns.reduce<Record<string, any>>((values, column) => {
        if (column === hydrationPlan.rootPrimaryKey) {
          values[column] = id;
        } else if (column === 'settings') {
          values[column] = '{}';
        } else if (column === 'deleted_at') {
          values[column] = null;
        } else {
          values[column] = `user-${column}-${id}`;
        }
        return values;
      }, {});

    const rows: Array<Record<string, any>> = [];
    for (let userId = 1; userId <= pageSize; userId++) {
      const baseRow = buildRootRow(userId);
      for (let orderIndex = 0; orderIndex < 2; orderIndex++) {
        const order = {
          id: userId * 100 + orderIndex,
          user_id: userId,
          total: 50 + orderIndex,
          status: orderIndex === 0 ? 'open' : 'shipped'
        };
        const row: Record<string, any> = { ...baseRow };
        for (const column of relationPlan.columns) {
          const alias = makeRelationAlias(relationPlan.aliasPrefix, column);
          row[alias] = order[column as keyof typeof order];
        }
        rows.push(row);
      }
    }

    const response: QueryResult = {
      columns,
      values: rows.map(row => columns.map(col => row[col]))
    };

    const { executor, executed } = createMockExecutor([[response]]);
    const session = createSession(new SqliteDialect(), executor);

    const users = await builder.execute(session);

    expect(totalPages).toBe(3);
    expect(response.values).toHaveLength(pageSize * 2);
    expect(users).toHaveLength(10);
    expect(users.map(user => user.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    for (const user of users) {
      const orders = await (user.orders as HasManyCollection<any>).load();
      expect(orders).toHaveLength(2);
    }

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('__metal_pagination_page');
    expect(executed[0].sql).toContain('LIMIT 10');
  });
});
