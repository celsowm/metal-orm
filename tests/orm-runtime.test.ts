import { describe, expect, it } from 'vitest';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { OrmContext, DbExecutor, QueryResult } from '../src/orm/orm-context.js';
import { createEntityFromRow } from '../src/orm/entity.js';
import { Users, Orders } from './fixtures/schema.js';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column.js';
import { hasMany, belongsTo, belongsToMany } from '../src/schema/relation.js';
import type { HasManyCollection, BelongsToReference, ManyToManyCollection } from '../src/schema/types.js';

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

const TestOrders = defineTable('test_orders', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  total: col.int(),
  status: col.varchar(50)
});

const TestProjects = defineTable('test_projects', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  client: col.varchar(255)
});

const TestUserProjects = defineTable('test_user_projects', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  project_id: col.int()
});

const TestUsers = defineTable('test_users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255)
});

TestUsers.relations = {
  orders: hasMany(TestOrders, 'user_id', undefined, 'remove'),
  projects: belongsToMany(TestProjects, TestUserProjects, {
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'project_id',
    cascade: 'link'
  })
};

TestOrders.relations = {
  user: belongsTo(TestUsers, 'user_id')
};

TestProjects.relations = {};
TestUserProjects.relations = {};

describe('OrmContext entity graphs', () => {
  it('lazy loads has-many relations in batches', async () => {
    const responses: QueryResult[][] = [
      [
        {
          columns: ['id', 'name'],
          values: [[1, 'Alice']]
        }
      ],
      [
        {
          columns: ['id', 'user_id', 'total', 'status'],
          values: [
            [10, 1, 100, 'open'],
            [11, 1, 200, 'shipped']
          ]
        }
      ]
    ];
    const { executor, executed } = createMockExecutor(responses);
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const builder = new SelectQueryBuilder(Users)
      .select({
        id: Users.columns.id,
        name: Users.columns.name
      })
      .includeLazy('orders');

    const [user] = await builder.execute(ctx);
    expect(user).toBeDefined();
    expect(executed).toHaveLength(1);

    const orders = await (user.orders as HasManyCollection<any>).load();
    expect(orders).toHaveLength(2);
    expect(orders.map(order => order.total)).toEqual([100, 200]);
    expect(executed[1].sql).toContain('"orders"');
  });

  it('captures every SQL call via queryLogger option', async () => {
    const responses: QueryResult[][] = [
      [
        {
          columns: ['id', 'name'],
          values: [[1, 'Logger Test']]
        }
      ]
    ];
    const { executor, executed } = createMockExecutor(responses);
    const logs: Array<{ sql: string; params?: unknown[] }> = [];
    const ctx = new OrmContext({
      dialect: new SqliteDialect(),
      executor,
      queryLogger(entry) {
        logs.push(entry);
      }
    });

    const [user] = await new SelectQueryBuilder(Users)
      .select({
        id: Users.columns.id,
        name: Users.columns.name
      })
      .execute(ctx);

    expect(user).toBeDefined();
    expect(executed).toHaveLength(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(executed[0]);
  });

  it('preloads eager hydration data for has-many relations without extra queries', async () => {
    const { executor, executed } = createMockExecutor([]);
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const row = {
      id: 1,
      name: 'Alice',
      role: 'admin',
      settings: '{}',
      deleted_at: null,
      orders: [
        { id: 10, user_id: 1, total: 120, status: 'open' },
        { id: 11, user_id: 1, total: 230, status: 'completed' }
      ]
    };

    const user = createEntityFromRow(ctx, Users, row);
    const ordersRelation = user.orders as HasManyCollection<any>;
    expect(ordersRelation.getItems()).toHaveLength(2);

    const orders = await ordersRelation.load();
    expect(orders).toHaveLength(2);
    expect(orders.map(order => order.total)).toEqual([120, 230]);
    expect(executed).toHaveLength(0);
  });

  it('reuses eagerly hydrated belongs-to data and lazily loads belongs-to-many', async () => {
    const rootRow: QueryResult = {
      columns: [
        'id',
        'user_id',
        'total',
        'status',
        'user__id',
        'user__name',
        'user__role',
        'user__settings',
        'user__deleted_at'
      ],
      values: [[42, 1, 15, 'pending', 1, 'Alice', 'admin', '{}', null]]
    };

    const responses: QueryResult[][] = [
      [rootRow],
      [
        {
          columns: ['id', 'project_id', 'user_id', 'role_id', 'assigned_at'],
          values: [[1, 10, 1, 3, '2025-12-03']]
        }
      ],
      [
        {
          columns: ['id', 'name', 'client'],
          values: [[10, 'Apollo', 'Acme Corp']]
        }
      ]
    ];

    const { executor, executed } = createMockExecutor(responses);
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const builder = new SelectQueryBuilder(Orders)
      .select({
        id: Orders.columns.id,
        user_id: Orders.columns.user_id,
        total: Orders.columns.total,
        status: Orders.columns.status
      })
      .include('user');

    const [order] = await builder.execute(ctx);
    expect(order).toBeDefined();
    expect(executed).toHaveLength(1);

    const user = await (order.user as BelongsToReference<any>).load();
    expect(user).toBeDefined();
    expect(user?.name).toBe('Alice');
    expect(executed).toHaveLength(1);

    const projects = await (user!.projects as ManyToManyCollection<any>).load();
    expect(executed).toHaveLength(3);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Apollo');
    expect((projects[0] as any)._pivot).toMatchObject({
      project_id: 10,
      user_id: 1,
      id: 1
    });
    expect(executed[1].sql).toContain('"project_assignments"');
    expect(executed[2].sql).toContain('"projects"');
  });

  it('flushes relation mutations through saveChanges with cascading SQL', async () => {
    const responses: QueryResult[][] = [
      [
        {
          columns: ['id', 'name'],
          values: [[1, 'Manager']]
        }
      ],
      [
        {
          columns: ['id', 'user_id', 'total', 'status'],
          values: [[10, 1, 180, 'open']]
        }
      ],
      [
        {
          columns: ['id', 'project_id', 'user_id'],
          values: [[1, 100, 1]]
        }
      ],
      [
        {
          columns: ['id', 'name', 'client'],
          values: [[100, 'Apollo', 'Acme Corp']]
        }
      ]
    ];

    const { executor, executed } = createMockExecutor(responses);
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const [user] = await new SelectQueryBuilder(TestUsers)
      .select({
        id: TestUsers.columns.id,
        name: TestUsers.columns.name
      })
      .execute(ctx);

    const orderRelation = user.orders as HasManyCollection<any>;
    const orders = await orderRelation.load();
    expect(orders).toHaveLength(1);

    const removedOrder = orders[0];
    orderRelation.remove(removedOrder);
    orderRelation.add({ total: 999, status: 'pending' });

    const projectRelation = user.projects as ManyToManyCollection<any>;
    await projectRelation.syncByIds(['200']);

    await ctx.saveChanges();

    const payload = executed.slice(-4);
    expect(payload[0].sql).toContain('INSERT INTO "test_orders"');
    expect(payload[1].sql).toContain('INSERT INTO "test_user_projects"');
    expect(payload[2].sql).toContain('DELETE FROM "test_user_projects"');
    expect(payload[3].sql).toContain('DELETE FROM "test_orders"');
  });

  it('does not collapse duplicates when executing set-operation queries', async () => {
    const responses: QueryResult[][] = [
      [
        {
          columns: ['id', 'name'],
          values: [
            [1, 'Alice'],
            [1, 'Alice 2']
          ]
        }
      ]
    ];

    const { executor } = createMockExecutor(responses);
    const ctx = new OrmContext({ dialect: new SqliteDialect(), executor });

    const query = new SelectQueryBuilder(TestUsers)
      .select({
        id: TestUsers.columns.id,
        name: TestUsers.columns.name
      })
      .unionAll(
        new SelectQueryBuilder(TestUsers).select({
          id: TestUsers.columns.id,
          name: TestUsers.columns.name
        })
      );

    const results = await query.execute(ctx);
    expect(results).toHaveLength(2);
    expect(results[0]).not.toBe(results[1]);
    expect([results[0].name, results[1].name]).toEqual(['Alice', 'Alice 2']);
  });
});
