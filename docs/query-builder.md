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
