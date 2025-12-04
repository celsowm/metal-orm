# Query Builder

MetalORM's query builder provides a fluent and expressive API for constructing SQL queries.

## Selecting Data

The `SelectQueryBuilder` is the main entry point for building `SELECT` queries.

### Basic Selections

You can select all columns using `selectRaw('*')` or specify columns using `select()`:

```typescript
// Select all columns
const query = new SelectQueryBuilder(users).selectRaw('*');

// Select specific columns
const query = new SelectQueryBuilder(users).select({
  id: users.columns.id,
  name: users.columns.name,
});
```

### Joins

You can join tables using `leftJoin`, `innerJoin`, `rightJoin`, etc.

```typescript
const query = new SelectQueryBuilder(users)
  .select({
    userId: users.columns.id,
    postTitle: posts.columns.title,
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id));
```

### Filtering

You can filter results using the `where()` method with expression helpers:

```typescript
const query = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(and(
    like(users.columns.name, '%John%'),
    gt(users.columns.createdAt, new Date('2023-01-01'))
  ));
```

### Aggregation

You can use aggregate functions like `count()`, `sum()`, `avg()`, etc., and group the results.

```typescript
const query = new SelectQueryBuilder(users)
  .select({
    userId: users.columns.id,
    postCount: count(posts.columns.id),
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .groupBy(users.columns.id)
  .having(gt(count(posts.columns.id), 5));
```

### Ordering and Pagination

You can order the results using `orderBy()` and paginate using `limit()` and `offset()`.

```typescript
const query = new SelectQueryBuilder(posts)
  .selectRaw('*')
  .orderBy(posts.columns.createdAt, 'DESC')
  .limit(10)
  .offset(20);
```

### Window Functions

The query builder supports window functions for advanced analytics:

```typescript
import { rowNumber, rank } from 'metal-orm';

const query = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    rowNum: rowNumber(),
    userRank: rank()
  })
  .partitionBy(users.columns.department)
  .orderBy(users.columns.salary, 'DESC');
```

### CTEs (Common Table Expressions)

You can use CTEs to organize complex queries:

```typescript
const activeUsers = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(gt(users.columns.lastLogin, new Date('2023-01-01')))
  .as('active_users');

const query = new SelectQueryBuilder(activeUsers)
  .with(activeUsers)
  .selectRaw('*')
  .where(eq(activeUsers.columns.id, 1));
```

### Subqueries

Support for subqueries in SELECT and WHERE clauses:

```typescript
const subquery = new SelectQueryBuilder(posts)
  .select({ count: count(posts.columns.id) })
  .where(eq(posts.columns.userId, users.columns.id));

const query = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    postCount: subquery
  });

## From Builder to Entities

You can keep using the query builder on its own, or plug it into the entity runtime:

- `builder.compile(dialect)` → SQL + params → driver (builder-only usage).
- `builder.execute(ctx)` → entities tracked by an `OrmContext` (runtime usage).

See [Runtime & Unit of Work](./runtime.md) for how `execute(ctx)` integrates with entities and lazy relations.
```
