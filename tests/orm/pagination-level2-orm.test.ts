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
  const orm = new Orm({ dialect, executorFactory: factory });
  return new OrmSession({ orm, executor });
};

describe('Level 2 ORM pagination', () => {
  it('applies the pagination guard when eager has-many includes are paged', async () => {
    const pageSize = 2;
    const pageNumber = 3;

    const builder = new SelectQueryBuilder(Users)
      .include('orders', {
        columns: ['id', 'user_id', 'total', 'status']
      })
      .orderBy(Users.columns.id, 'ASC')
      .limit(pageSize)
      .offset((pageNumber - 1) * pageSize);

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();
    const hydrationPlan = plan!;
    const relationPlan = hydrationPlan.relations.find(rel => rel.name === 'orders');
    expect(relationPlan).toBeDefined();

    const rootColumns = hydrationPlan.rootColumns.includes(hydrationPlan.rootPrimaryKey)
      ? [...hydrationPlan.rootColumns]
      : [...hydrationPlan.rootColumns, hydrationPlan.rootPrimaryKey];

    const relationColumns = relationPlan.columns.map(column =>
      makeRelationAlias(relationPlan.aliasPrefix, column)
    );

    const columns = [...rootColumns, ...relationColumns];
    const startUserId = (pageNumber - 1) * pageSize + 1;
    const rows: Array<Record<string, unknown>> = [];

    const buildRootRow = (id: number) =>
      rootColumns.reduce<Record<string, unknown>>((values, column) => {
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

    for (let userId = startUserId; userId < startUserId + pageSize; userId++) {
      const baseRow = buildRootRow(userId);
      for (let orderIndex = 0; orderIndex < 2; orderIndex++) {
        const order: Record<string, unknown> = {
          id: userId * 100 + orderIndex,
          user_id: userId,
          total: 100 + orderIndex,
          status: orderIndex === 0 ? 'open' : 'shipped'
        };

        const row: Record<string, unknown> = { ...baseRow };
        for (const column of relationPlan.columns) {
          const alias = makeRelationAlias(relationPlan.aliasPrefix, column);
          row[alias] = order[column];
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
    expect(users).toHaveLength(pageSize);
    expect(users.map(user => user.id)).toEqual(
      Array.from({ length: pageSize }, (_, index) => startUserId + index)
    );

    for (const user of users) {
      const orders = await (user.orders as HasManyCollection<any>).load();
      expect(orders).toHaveLength(2);
    }

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('__metal_pagination_page');
    expect(executed[0].sql).toContain('LIMIT 2');
    expect(executed[0].sql).toContain('OFFSET 4');
  });
});
