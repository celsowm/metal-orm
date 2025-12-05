import { describe, expect, it } from 'vitest';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { OrmContext } from '../src/orm/orm-context.js';
import { QueryResult, DbExecutor } from '../src/orm/db-executor.js';
import { HasManyCollection } from '../src/schema/types.js';
import { Users } from './fixtures/schema.js';
import { makeRelationAlias } from '../src/query-builder/relation-alias.js';

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
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const users = await builder.execute(ctx);
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
});
