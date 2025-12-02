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

MetalORM provides helpers for window functions like `RANK()`, `ROW_NUMBER()`, etc.

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
```
