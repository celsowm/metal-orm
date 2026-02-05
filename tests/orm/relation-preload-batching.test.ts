import { describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { QueryResult, DbExecutor } from '../../src/core/execution/db-executor.js';
import { BelongsToReference, HasManyCollection } from '../../src/schema/types.js';
import { makeRelationAlias } from '../../src/query-builder/relation-alias.js';

/**
 * Schema that exposes the redundant-query problem:
 *
 *   Tickets ──belongsTo──► Users (as "creator")
 *   Tickets ──belongsTo──► Users (as "assignee")
 *   Users   ──hasMany────► Orders
 *
 * Query: Tickets.include({ creator: { include: { orders: true } },
 *                          assignee: { include: { orders: true } } })
 *
 * Current behavior:
 *   1. Root query (tickets)
 *   2. BelongsTo batch for creator → Users
 *   3. HasMany batch for orders of creator-users
 *   4. BelongsTo batch for assignee → Users
 *   5. HasMany batch for orders of assignee-users  ← REDUNDANT (same table as #3)
 *
 * Optimal behavior: queries 3 and 5 should be a single batch.
 */

const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const Orders = defineTable('orders', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  total: col.int(),
});

const Tickets = defineTable('tickets', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  creator_id: col.int(),
  assignee_id: col.int(),
});

Users.relations = {
  orders: hasMany(Orders, 'user_id'),
};

Orders.relations = {
  user: belongsTo(Users, 'user_id'),
};

Tickets.relations = {
  creator: belongsTo(Users, 'creator_id'),
  assignee: belongsTo(Users, 'assignee_id'),
};

const createMockExecutor = (
  responses: QueryResult[][]
): {
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
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    dispose: async () => {},
  };
  return { executor, executed };
};

const createSession = (
  dialect: SqliteDialect,
  executor: DbExecutor
): OrmSession => {
  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => {},
  };
  const orm = new Orm({ dialect, executorFactory: factory });
  return new OrmSession({ orm, executor });
};

describe('relation-preload batching – redundant query proof', () => {
  it('executes redundant orders queries when the same nested relation is included via two different parent relations', async () => {
    const dialect = new SqliteDialect();

    /**
     * Build the query:
     *   SELECT tickets.*
     *     .include({ creator: { include: { orders: true } },
     *                assignee: { include: { orders: true } } })
     *
     * "creator" and "assignee" are both belongsTo(Users), and both
     * include the same nested hasMany relation (orders).
     */
    const builder = new SelectQueryBuilder(Tickets).include({
      creator: { include: { orders: true } },
      assignee: { include: { orders: true } },
    });

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();

    const rootColumns = Object.keys(Tickets.columns);

    // ── Mock responses in execution order ──────────────────────────

    // Response 1: root tickets query → 2 tickets
    // Ticket 1: creator_id=10, assignee_id=20
    // Ticket 2: creator_id=10, assignee_id=30  (same creator, different assignee)
    const ticketRows: QueryResult = {
      columns: rootColumns,
      values: [
        [1, 'Bug fix', 10, 20],
        [2, 'Feature', 10, 30],
      ],
    };

    // Response 2: belongsTo batch for "creator" → Users WHERE id IN (10)
    const creatorRows: QueryResult = {
      columns: ['id', 'name'],
      values: [[10, 'Alice']],
    };

    // Response 3: hasMany batch for "orders" of creator-users → Orders WHERE user_id IN (10)
    const creatorOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [100, 10, 500],
        [101, 10, 300],
      ],
    };

    // Response 4: belongsTo batch for "assignee" → Users WHERE id IN (20, 30)
    const assigneeRows: QueryResult = {
      columns: ['id', 'name'],
      values: [
        [20, 'Bob'],
        [30, 'Charlie'],
      ],
    };

    // Response 5: hasMany batch for "orders" of assignee-users → Orders WHERE user_id IN (20, 30)
    // This is the REDUNDANT query — same table (orders) as response 3.
    const assigneeOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [200, 20, 150],
        [300, 30, 250],
      ],
    };

    const { executor, executed } = createMockExecutor([
      [ticketRows],
      [creatorRows],
      [creatorOrderRows],
      [assigneeRows],
      [assigneeOrderRows],
    ]);

    const session = createSession(dialect, executor);
    const tickets = await builder.execute(session);

    expect(tickets).toHaveLength(2);

    // Trigger lazy load of nested relations
    const ticket1 = tickets[0] as unknown as Record<string, unknown>;
    const ticket2 = tickets[1] as unknown as Record<string, unknown>;

    const creator1 = ticket1.creator as BelongsToReference<Record<string, unknown>>;
    const assignee1 = ticket1.assignee as BelongsToReference<Record<string, unknown>>;

    const creatorEntity = await creator1.load();
    const assigneeEntity = await assignee1.load();

    expect(creatorEntity).toBeDefined();
    expect(assigneeEntity).toBeDefined();

    // ── Assert the redundancy ──────────────────────────────────────

    // Count how many SQL calls target the "orders" table
    const orderQueries = executed.filter((q) => q.sql.includes('"orders"'));

    // CURRENT BEHAVIOR: 2 separate queries to "orders" table
    //   - one for creator-users (user_id IN (10))
    //   - one for assignee-users (user_id IN (20, 30))
    //
    // OPTIMAL BEHAVIOR (after batching optimization): should be 1 query
    //   - orders WHERE user_id IN (10, 20, 30)
    expect(orderQueries).toHaveLength(2);

    // Total queries: 5 (1 root + 2 belongsTo + 2 orders)
    // After optimization: 4 (1 root + 2 belongsTo + 1 orders)
    expect(executed).toHaveLength(5);

    // Log all queries for visibility
    for (const [i, q] of executed.entries()) {
      const target = q.sql.includes('"tickets"')
        ? 'tickets'
        : q.sql.includes('"users"')
          ? 'users'
          : q.sql.includes('"orders"')
            ? 'orders'
            : 'unknown';
      console.log(`Query ${i + 1} [${target}]: ${q.sql}`);
    }
  });

  it('redundancy grows with more tickets — orders table is still queried twice', async () => {
    /**
     * With 3 tickets (6 distinct user IDs), the redundancy is the same:
     * 2 separate "orders" queries instead of 1.
     *
     * The root query JOINs users for both creator and assignee eagerly,
     * but the lazy batch loader for the nested belongsTo still fires
     * a separate query per relation to resolve entities not yet tracked.
     */
    const dialect = new SqliteDialect();

    const builder = new SelectQueryBuilder(Tickets).include({
      creator: { include: { orders: true } },
      assignee: { include: { orders: true } },
    });

    // Root query includes LEFT JOINs for creator and assignee
    const plan = builder.getHydrationPlan()!;
    const rootCols = plan.rootColumns;
    const creatorAlias = plan.relations.find((r) => r.name === 'creator')!.aliasPrefix;
    const assigneeAlias = plan.relations.find((r) => r.name === 'assignee')!.aliasPrefix;

    const creatorCols = ['id', 'name'].map((c) => makeRelationAlias(creatorAlias, c));
    const assigneeCols = ['id', 'name'].map((c) => makeRelationAlias(assigneeAlias, c));
    const allCols = [...rootCols, ...creatorCols, ...assigneeCols];

    const ticketRows: QueryResult = {
      columns: allCols,
      values: [
        [1, 'T1', 10, 20, 10, 'U10', 20, 'U20'],
        [2, 'T2', 11, 21, 11, 'U11', 21, 'U21'],
        [3, 'T3', 12, 22, 12, 'U12', 22, 'U22'],
      ],
    };

    // After hydration, preloadRelationIncludes loads nested "orders" for creator-users
    const creatorOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [100, 10, 10],
        [101, 11, 20],
        [102, 12, 30],
      ],
    };

    // Then loads nested "orders" for assignee-users — REDUNDANT same table
    const assigneeOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [200, 20, 40],
        [201, 21, 50],
        [202, 22, 60],
      ],
    };

    const { executor, executed } = createMockExecutor([
      [ticketRows],
      [creatorOrderRows],
      [assigneeOrderRows],
    ]);

    const session = createSession(dialect, executor);
    await builder.execute(session);

    const orderQueries = executed.filter((q) => q.sql.includes('"orders"'));

    // 2 order queries is the REDUNDANCY — both target the same "orders" table
    // After optimization this should be 1
    expect(orderQueries).toHaveLength(2);

    // Total: 3 queries (1 root with JOINs + 2 orders).
    // After optimization: 2 (1 root + 1 orders).
    expect(executed).toHaveLength(3);

    for (const [i, q] of executed.entries()) {
      const target = q.sql.includes('"tickets"')
        ? 'tickets'
        : q.sql.includes('"orders"')
          ? 'orders'
          : 'unknown';
      console.log(`Query ${i + 1} [${target}]: ${q.sql}`);
    }
  });
});
