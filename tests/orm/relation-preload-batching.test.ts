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

    // Response 3: belongsTo batch for "assignee" → Users WHERE id IN (20, 30)
    const assigneeRows: QueryResult = {
      columns: ['id', 'name'],
      values: [
        [20, 'Bob'],
        [30, 'Charlie'],
      ],
    };

    // Response 4: BATCHED hasMany for "orders" of ALL users (creator + assignee)
    // → Orders WHERE user_id IN (10, 20, 30)
    const allOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [100, 10, 500],
        [101, 10, 300],
        [200, 20, 150],
        [300, 30, 250],
      ],
    };

    const { executor, executed } = createMockExecutor([
      [ticketRows],
      [creatorRows],
      [assigneeRows],
      [allOrderRows],
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

    // ── Assert the optimization ────────────────────────────────────

    // Count how many SQL calls target the "orders" table
    const orderQueries = executed.filter((q) => q.sql.includes('"orders"'));

    // OPTIMIZED: 1 single batched query to "orders" table
    // combining all user IDs from both creator and assignee relations
    expect(orderQueries).toHaveLength(1);

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

    // After hydration, preloadRelationIncludes batches nested "orders"
    // for ALL users (creator + assignee) into a single query
    const allOrderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [100, 10, 10],
        [101, 11, 20],
        [102, 12, 30],
        [200, 20, 40],
        [201, 21, 50],
        [202, 22, 60],
      ],
    };

    const { executor, executed } = createMockExecutor([
      [ticketRows],
      [allOrderRows],
    ]);

    const session = createSession(dialect, executor);
    await builder.execute(session);

    const orderQueries = executed.filter((q) => q.sql.includes('"orders"'));

    // OPTIMIZED: 1 single batched query to "orders" table
    expect(orderQueries).toHaveLength(1);

    // Total: 2 queries (1 root with JOINs + 1 batched orders).
    expect(executed).toHaveLength(2);

    for (const [i, q] of executed.entries()) {
      const target = q.sql.includes('"tickets"')
        ? 'tickets'
        : q.sql.includes('"orders"')
          ? 'orders'
          : 'unknown';
      console.log(`Query ${i + 1} [${target}]: ${q.sql}`);
    }
  });

  it('handles duplicate user entity when creator_id === assignee_id', async () => {
    /**
     * When the same user is both creator and assignee of a ticket,
     * the identity map returns the same entity instance for both relations.
     * The batched array will contain that entity twice, but the lazy batch
     * loader deduplicates FK values via collectKeysFromRoots (Set),
     * so only one query with a single ID is emitted.
     */
    const dialect = new SqliteDialect();

    const builder = new SelectQueryBuilder(Tickets).include({
      creator: { include: { orders: true } },
      assignee: { include: { orders: true } },
    });

    const plan = builder.getHydrationPlan()!;
    const rootCols = plan.rootColumns;
    const creatorAlias = plan.relations.find((r) => r.name === 'creator')!.aliasPrefix;
    const assigneeAlias = plan.relations.find((r) => r.name === 'assignee')!.aliasPrefix;

    const creatorCols = ['id', 'name'].map((c) => makeRelationAlias(creatorAlias, c));
    const assigneeCols = ['id', 'name'].map((c) => makeRelationAlias(assigneeAlias, c));
    const allCols = [...rootCols, ...creatorCols, ...assigneeCols];

    // creator_id=10 AND assignee_id=10 → same user
    const ticketRows: QueryResult = {
      columns: allCols,
      values: [[1, 'Self-assigned', 10, 10, 10, 'Alice', 10, 'Alice']],
    };

    // Single orders query for user 10
    const orderRows: QueryResult = {
      columns: ['id', 'user_id', 'total'],
      values: [
        [100, 10, 500],
        [101, 10, 300],
      ],
    };

    const { executor, executed } = createMockExecutor([
      [ticketRows],
      [orderRows],
    ]);

    const session = createSession(dialect, executor);
    const tickets = await builder.execute(session);

    expect(tickets).toHaveLength(1);

    const ticket = tickets[0] as unknown as Record<string, unknown>;
    const creator = ticket.creator as BelongsToReference<Record<string, unknown>>;
    const assignee = ticket.assignee as BelongsToReference<Record<string, unknown>>;

    const creatorEntity = await creator.load();
    const assigneeEntity = await assignee.load();

    // Same user instance returned for both relations (identity map)
    expect(creatorEntity).toBe(assigneeEntity);
    expect((creatorEntity as Record<string, unknown>).name).toBe('Alice');

    // Only 1 orders query, with user_id IN (10) — no duplicates
    const orderQueries = executed.filter((q) => q.sql.includes('"orders"'));
    expect(orderQueries).toHaveLength(1);

    // Total: 2 queries (1 root with JOINs + 1 orders)
    expect(executed).toHaveLength(2);

    // Verify orders are accessible from both creator and assignee paths
    const creatorOrders = await (creatorEntity as Record<string, unknown>).orders as HasManyCollection<Record<string, unknown>>;
    const items = await creatorOrders.load();
    expect(items).toHaveLength(2);
  });
});
