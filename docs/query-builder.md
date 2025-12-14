# Query Builder

MetalORM's query builder provides a fluent and expressive API for constructing SQL queries.

## Selecting Data

The `SelectQueryBuilder` is the main entry point for building `SELECT` queries.

### Basic Selections

You can select all columns using `selectRaw('*')`, or use `selectColumns()` (or the `sel()` helper) when you just need a few fields:

```typescript
// Select all columns
const query = new SelectQueryBuilder(users).selectRaw('*');

// Select specific columns
const query = new SelectQueryBuilder(users).selectColumns('id', 'name');
```

When you need computed columns alongside root scalars, spread a `sel()` map into `select()` and add the extras manually (see the "Selection helpers" section below).

### Selection helpers

Use specialized helpers to keep selection maps concise while preserving typing:

- `selectColumns(...names)` builds typed selections for the root table.
- `sel(table, ...names)` returns a selection map you can spread inside `.select()` alongside computed fields.
- `selectRelationColumns` / `includePick` pull in a relation’s columns and automatically add the necessary join.
- `selectColumnsDeep` fans out a config object across the root table and its relations.
- `esel(Entity, ...)` mirrors `sel` but starts from a decorator-bound entity class.

```typescript
import { sel, count } from 'metal-orm';

const query = new SelectQueryBuilder(users)
  .select({
    ...sel(users, 'id', 'name', 'email'),
    postCount: count(posts.columns.id),
  })
  .selectRelationColumns('posts', 'id', 'title')
  .includePick('posts', ['createdAt']);
```

Assuming `posts` is a related table on `users` (e.g. a `hasMany` or `hasOne`), the helpers above keep the AST typed without spelling `users.columns.*` repeatedly, and they automatically widen your joins so relations stay hydrated.

These helpers are the recommended way to build typed selections and to avoid repeating `table.columns.*` everywhere; keep using `table.columns` when defining schema metadata, constraints, or relations.

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
- `builder.execute(session)` → entities tracked by an `OrmSession` (runtime usage).

See [Runtime & Unit of Work](./runtime.md) for how `execute(session)` integrates with entities and lazy relations.
```
