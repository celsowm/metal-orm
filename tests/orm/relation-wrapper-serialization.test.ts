import { describe, expect, it } from 'vitest';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import { Users, Orders, Profiles } from '../fixtures/schema.js';
import { makeRelationAlias } from '../../src/query-builder/relation-alias.js';
import type { BelongsToReference, HasManyCollection, HasOneReference } from '../../src/schema/types.js';

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

const createSession = (
  executor: DbExecutor,
  queryLogger?: (entry: { sql: string; params?: unknown[] }) => void
): OrmSession => {
  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => { }
  };
  const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: factory });
  return new OrmSession({ orm, executor, queryLogger });
};

/**
 * This test suite verifies that relation wrappers serialize correctly.
 *
 * Issue: When accessing entities with included relations directly (not via JSON.stringify),
 * the relation wrappers may expose internal properties like `loaded` and `current`.
 *
 * Expected: When serialized (via JSON.stringify or toJSON), relation data should be flattened
 * to just the entity data without wrapper properties.
 */
describe('relation wrapper serialization', () => {
  describe('BelongsTo serialization', () => {
    it('should serialize BelongsTo relation without loaded/current wrapper via JSON.stringify', async () => {
      const builder = new SelectQueryBuilder(Orders)
        .select({
          id: Orders.columns.id,
          total: Orders.columns.total,
          user_id: Orders.columns.user_id
        })
        .includePick('user', ['id', 'name']);

      const hydrationPlan = builder.getHydrationPlan();
      expect(hydrationPlan).toBeDefined();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'user');
      expect(relationPlan).toBeDefined();
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'total', 'user_id',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'name')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 100, 10, 10, 'Alice']]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [order] = await builder.execute(session);

      // Test: JSON.stringify should NOT include loaded/current
      const json = JSON.stringify(order);
      const parsed = JSON.parse(json);

      expect(parsed.user).toBeDefined();
      expect(parsed.user.id).toBe(10);
      expect(parsed.user.name).toBe('Alice');
      expect(parsed.user).not.toHaveProperty('loaded');
      expect(parsed.user).not.toHaveProperty('current');
    });

    it('should serialize BelongsTo relation correctly when toJSON is called', async () => {
      const builder = new SelectQueryBuilder(Orders)
        .select({
          id: Orders.columns.id,
          total: Orders.columns.total,
          user_id: Orders.columns.user_id
        })
        .includePick('user', ['id', 'name']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'user');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'total', 'user_id',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'name')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 100, 10, 10, 'Alice']]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [order] = await builder.execute(session);

      // Directly call toJSON
      const jsonResult = (order as any).toJSON();

      expect(jsonResult.user).toBeDefined();
      expect(jsonResult.user.id).toBe(10);
      expect(jsonResult.user.name).toBe('Alice');
      expect(jsonResult.user).not.toHaveProperty('loaded');
      expect(jsonResult.user).not.toHaveProperty('current');
    });
  });

  describe('HasOne serialization', () => {
    it('should serialize HasOne relation without loaded/current wrapper', async () => {
      const builder = new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name
        })
        .includePick('profile', ['id', 'bio']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'profile');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'name',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'bio'),
        makeRelationAlias(aliasPrefix, 'user_id')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 'Alice', 1, 'Software Engineer', 1]]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [user] = await builder.execute(session);

      const json = JSON.stringify(user);
      const parsed = JSON.parse(json);

      expect(parsed.profile).toBeDefined();
      expect(parsed.profile.id).toBe(1);
      expect(parsed.profile.bio).toBe('Software Engineer');
      expect(parsed.profile).not.toHaveProperty('loaded');
      expect(parsed.profile).not.toHaveProperty('current');
    });
  });

  describe('HasMany serialization', () => {
    it('should serialize HasMany relation without loaded/items wrapper', async () => {
      const builder = new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name
        })
        .includePick('orders', ['id', 'total']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'orders');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'name',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'total'),
        makeRelationAlias(aliasPrefix, 'user_id')
      ];

      const response: QueryResult = {
        columns,
        values: [
          [1, 'Alice', 10, 100, 1],
          [1, 'Alice', 11, 200, 1]
        ]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [user] = await builder.execute(session);

      const json = JSON.stringify(user);
      const parsed = JSON.parse(json);

      expect(parsed.orders).toBeDefined();
      expect(Array.isArray(parsed.orders)).toBe(true);
      expect(parsed.orders).toHaveLength(2);
      expect(parsed.orders[0].id).toBe(10);
      expect(parsed.orders[0].total).toBe(100);
      expect(parsed).not.toHaveProperty('loaded');
      expect(parsed.orders).not.toHaveProperty('loaded');
      expect(parsed.orders).not.toHaveProperty('items');
    });
  });

  describe('wrapper enumerable properties', () => {
    it('BelongsTo wrapper properties (loaded, current) should not be enumerable', async () => {
      const builder = new SelectQueryBuilder(Orders)
        .select({
          id: Orders.columns.id,
          total: Orders.columns.total,
          user_id: Orders.columns.user_id
        })
        .includePick('user', ['id', 'name']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'user');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'total', 'user_id',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'name')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 100, 10, 10, 'Alice']]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [order] = await builder.execute(session);

      // Access the relation wrapper directly
      const userWrapper = (order as any).user as BelongsToReference<any>;

      // Check that internal properties are not enumerable
      const enumerableKeys = Object.keys(userWrapper);
      expect(enumerableKeys).not.toContain('loaded');
      expect(enumerableKeys).not.toContain('current');
    });

    it('HasMany wrapper properties (loaded, items) should not be enumerable', async () => {
      const builder = new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name
        })
        .includePick('orders', ['id', 'total']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'orders');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'name',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'total'),
        makeRelationAlias(aliasPrefix, 'user_id')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 'Alice', 10, 100, 1]]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [user] = await builder.execute(session);

      // Access the relation wrapper directly
      const ordersWrapper = (user as any).orders as HasManyCollection<any>;

      // Check that internal properties are not enumerable
      const enumerableKeys = Object.keys(ordersWrapper);
      expect(enumerableKeys).not.toContain('loaded');
      expect(enumerableKeys).not.toContain('items');
      expect(enumerableKeys).not.toContain('current');
    });
  });

  describe('framework simulation', () => {
    it('should serialize correctly when framework uses Object.assign (simulates spread operator)', async () => {
      const builder = new SelectQueryBuilder(Orders)
        .select({
          id: Orders.columns.id,
          total: Orders.columns.total,
          user_id: Orders.columns.user_id
        })
        .includePick('user', ['id', 'name']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'user');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'total', 'user_id',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'name')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 100, 10, 10, 'Alice']]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [order] = await builder.execute(session);

      // Simulate what some frameworks do: Object.assign or spread
      const copied = { ...order };
      const json = JSON.stringify(copied);
      const parsed = JSON.parse(json);

      // This is the key test - after spreading the entity, the relation should still serialize correctly
      expect(parsed.user).toBeDefined();
      expect(parsed.user).not.toHaveProperty('loaded');
      expect(parsed.user).not.toHaveProperty('current');
    });

    it('should serialize correctly when framework iterates Object.entries', async () => {
      const builder = new SelectQueryBuilder(Orders)
        .select({
          id: Orders.columns.id,
          total: Orders.columns.total,
          user_id: Orders.columns.user_id
        })
        .includePick('user', ['id', 'name']);

      const hydrationPlan = builder.getHydrationPlan();
      const relationPlan = hydrationPlan!.relations.find(rel => rel.name === 'user');
      const aliasPrefix = relationPlan!.aliasPrefix;

      const columns = [
        'id', 'total', 'user_id',
        makeRelationAlias(aliasPrefix, 'id'),
        makeRelationAlias(aliasPrefix, 'name')
      ];

      const response: QueryResult = {
        columns,
        values: [[1, 100, 10, 10, 'Alice']]
      };

      const { executor } = createMockExecutor([[response]]);
      const session = createSession(executor);

      const [order] = await builder.execute(session);

      // Simulate what some frameworks do: iterate via Object.entries
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(order)) {
        result[key] = value;
      }

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.user).toBeDefined();
      expect(parsed.user).not.toHaveProperty('loaded');
      expect(parsed.user).not.toHaveProperty('current');
    });
  });
});
