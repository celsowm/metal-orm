# Advanced Features

MetalORM supports a wide range of advanced SQL features to handle complex scenarios.

## Common Table Expressions (CTEs)

CTEs help organize complex queries. You can define a CTE using a `SelectQueryBuilder` and reference it in the main query.

```typescript
const since = new Date();
since.setDate(since.getDate() - 30);

const activeUsers = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(gt(users.columns.lastLogin, since))
  .as('active_users');

const query = new SelectQueryBuilder(activeUsers)
  .with(activeUsers)
  .selectRaw('*')
  .where(eq(activeUsers.columns.id, 1));
```

## Window Functions

MetalORM provides comprehensive support for window functions including `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, and more.

### Basic Window Functions

```typescript
const rankedPosts = new SelectQueryBuilder(posts)
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
import { rowNumber, rank, denseRank, lag, lead } from 'metal-orm';

// Simple row numbering
const query1 = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    rowNum: rowNumber()
  });

// Ranking with partitioning
const query2 = new SelectQueryBuilder(orders)
  .select({
    id: orders.columns.id,
    customerId: orders.columns.customerId,
    amount: orders.columns.amount,
    rank: rank()
  })
  .partitionBy(orders.columns.customerId)
  .orderBy(orders.columns.amount, 'DESC');

// LAG and LEAD functions
const query3 = new SelectQueryBuilder(sales)
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
const usersWithPosts = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(exists(
    new SelectQueryBuilder(posts)
      .selectRaw('1')
      .where(eq(posts.columns.userId, users.columns.id))
  ));
```

## JSON Operations

MetalORM provides helpers for working with JSON data.

```typescript
const userData = defineTable('user_data', {
  id: col.int().primaryKey(),
  userId: col.int().notNull(),
  preferences: col.json().notNull()
});

const jsonQuery = new SelectQueryBuilder(userData)
  .select({
    id: userData.columns.id,
    theme: jsonPath(userData.columns.preferences, '$.theme')
  })
  .where(eq(jsonPath(userData.columns.preferences, '$.theme'), 'dark'));
```

## CASE Expressions

You can use `caseWhen()` to create `CASE` expressions for conditional logic.

```typescript
const tieredUsers = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    tier: caseWhen([
      { when: gt(count(posts.columns.id), 10), then: 'power user' }
    ], 'regular')
  })
  .groupBy(users.columns.id);

## Advanced Runtime Patterns

When using the OrmContext runtime, you can implement advanced patterns like soft deletes, multi-tenant filtering, and optimistic concurrency.

### Soft Deletes

Use hooks to implement soft deletes:

```ts
const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
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
const ctx = new OrmContext({
  dialect: new MySqlDialect(),
  db: { /* ... */ },
  tenantId: 'tenant-123',
});

// All queries in this context automatically filter by tenant
const users = await new SelectQueryBuilder(usersTable)
  .execute(ctx); // WHERE tenantId = 'tenant-123'
```

### Optimistic Concurrency

Track version columns for conflict detection:

```ts
const posts = defineTable('posts', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  version: col.int().default(1),
});

ctx.saveChanges(); // throws if version mismatch
```
```
