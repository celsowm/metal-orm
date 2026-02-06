# Advanced Features

MetalORM supports a wide range of advanced SQL features to handle complex scenarios.

## Common Table Expressions (CTEs)

CTEs help organize complex queries. You can define a CTE using `selectFrom()` and reference it in the main query.

```typescript
import { selectFrom, gt, eq } from 'metal-orm';

const since = new Date();
since.setDate(since.getDate() - 30);

const activeUsers = selectFrom(users)
  .selectRaw('*')
  .where(gt(users.columns.lastLogin, since))
  .as('active_users');

const query = selectFrom(activeUsers)
  .with(activeUsers)
  .selectRaw('*')
  .where(eq(activeUsers.columns.id, 1));
```

## Set Operations (UNION / INTERSECT / EXCEPT)

Combine queries with `union`, `unionAll`, `intersect`, and `except`. ORDER BY / LIMIT / OFFSET apply only to the outermost query, and CTEs from operands are hoisted so `WITH` appears once.

```ts
import { selectFrom } from 'metal-orm';

const base = selectFrom(users).selectRaw('id');
const query = base
  .unionAll(selectFrom(users).selectRaw('id'))
  .orderBy(users.columns.id)
  .offset(2)
  .limit(5);
```

- Hydration metadata is skipped for compound queries. `.execute(session)` returns one entity proxy per row (not tracked in the identity map), preserving duplicates from `UNION ALL` and avoiding relation nesting. Use `.compile()` + your own executor if you just want raw rows.
- `EXISTS` over a set-operation subquery is supported; the subquery is wrapped as a derived table to keep the SQL valid.

## Window Functions

MetalORM provides comprehensive support for window functions including `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, and more.

### Basic Window Functions

```typescript
import { selectFrom, windowFunction } from 'metal-orm';

const rankedPosts = selectFrom(posts)
  .select({
    id: posts.columns.id,
    title: posts.columns.title,
    rank: windowFunction('RANK', [], [posts.columns.userId], [
      { column: posts.columns.createdAt, direction: 'DESC' }
    ])
  });
```

### Convenience Helpers

MetalORM provides convenience functions for common window functions:

```typescript
import { selectFrom, rowNumber, rank, denseRank, lag, lead } from 'metal-orm';

// Simple row numbering
const query1 = selectFrom(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    rowNum: rowNumber()
  });

// Ranking with partitioning
const query2 = selectFrom(orders)
  .select({
    id: orders.columns.id,
    customerId: orders.columns.customerId,
    amount: orders.columns.amount,
    rank: rank()
  })
  .partitionBy(orders.columns.customerId)
  .orderBy(orders.columns.amount, 'DESC');

// LAG and LEAD functions
const query3 = selectFrom(sales)
  .select({
    date: sales.columns.date,
    amount: sales.columns.amount,
    prevAmount: lag(sales.columns.amount, 1, 0),
    nextAmount: lead(sales.columns.amount, 1, 0)
  });
```

## Subqueries and EXISTS

You can use subqueries and `EXISTS` to perform complex checks.

```typescript
import { selectFrom, exists, eq } from 'metal-orm';

const usersWithPosts = selectFrom(users)
  .selectRaw('*')
  .where(exists(
    selectFrom(posts)
      .selectRaw('1')
      .where(eq(posts.columns.userId, users.columns.id))
  ));
```

## JSON Operations

MetalORM provides helpers for working with JSON data.

```typescript
import { defineTable, col, selectFrom, jsonPath, eq } from 'metal-orm';

const userData = defineTable('user_data', {
  id: col.primaryKey(col.int()),
  userId: col.notNull(col.int()),
  preferences: col.notNull(col.json())
});

const jsonQuery = selectFrom(userData)
  .select({
    id: userData.columns.id,
    theme: jsonPath(userData.columns.preferences, '$.theme')
  })
  .where(eq(jsonPath(userData.columns.preferences, '$.theme'), 'dark'));
```

## CASE Expressions

You can use `caseWhen()` to create `CASE` expressions for conditional logic.

```typescript
import { selectFrom, caseWhen, gt, count } from 'metal-orm';

const tieredUsers = selectFrom(users)
  .select({
    id: users.columns.id,
    tier: caseWhen([
      { when: gt(count(posts.columns.id), 10), then: 'power user' }
    ], 'regular')
  })
  .groupBy(users.columns.id);

## Advanced Runtime Patterns

When using the OrmSession runtime, you can implement advanced patterns like soft deletes, multi-tenant filtering, and optimistic concurrency.

### Soft Deletes

Use hooks to implement soft deletes:

```ts
import { defineTable, col } from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
  deletedAt: col.timestamp(),
}, undefined, {
  hooks: {
    beforeRemove(ctx, user) {
      user.deletedAt = new Date();
      return false; // prevent actual deletion
    },
  },
});
```

### Multi-Tenant Filters

Apply global filters via context:

```ts
import { OrmSession, selectFrom, eq } from 'metal-orm';

const session = new OrmSession({ orm, executor });
const tenantId = 'tenant-123';

// Apply the tenant filter before executing queries.
const users = await selectFrom(usersTable)
  .where(eq(usersTable.columns.tenantId, tenantId))
  .execute(session);
```

### Optimistic Concurrency

Track version columns for conflict detection:

```ts
import { defineTable, col } from 'metal-orm';

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.notNull(col.varchar(255)),
  version: col.default(col.int(), 1),
});

session.commit(); // throws if version mismatch
```

## Caching

MetalORM provides a flexible caching system that integrates with all levels of the ORM. See the [dedicated Caching documentation](./caching.md) for complete details.

### Quick Example

```ts
import { Orm, MemoryCacheAdapter, selectFromEntity } from 'metal-orm';

const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: myExecutorFactory,
  cache: {
    provider: new MemoryCacheAdapter(),
    defaultTtl: '1h'
  }
});

const session = orm.createSession();

// Cache with tags for easy invalidation
const users = await selectFromEntity(User)
  .cache('active_users', '30m', ['users', 'dashboard'])
  .execute(session);

// Later, invalidate by tag
await session.invalidateCacheTags(['dashboard']);
```

### Cache Invalidation Patterns

Common patterns for cache invalidation in complex applications:

```ts
// Pattern 1: Entity-based invalidation
// When an entity changes, invalidate all related caches
await session.invalidateCacheTags(['users', 'user-relations']);

// Pattern 2: Feature-based invalidation
// Invalidate all dashboard-related caches
await session.invalidateCacheTags(['dashboard']);

// Pattern 3: Tenant-based invalidation (multi-tenancy)
await session.invalidateCachePrefix(`tenant:${tenantId}:`);

// Pattern 4: Time-based expiration (TTL)
// Use short TTL for frequently changing data
.cache('live-data', '5m')

// Use long TTL for static data
.cache('countries', '1d')
```
