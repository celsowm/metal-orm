# SQL Functions

MetalORM exposes a set of typed helpers that mirror the SQL expressions you would normally write by hand. All of the helpers live inside `@orm/core/ast/expression.js` and return AST nodes that the `SelectQueryBuilder` (and its siblings) can compile into valid SQL for every dialect.

## Expression helpers

### Comparison and pattern matching

- `eq(left, right)`, `neq(...)`, `gt(...)`, `gte(...)`, `lt(...)`, `lte(...)` — the usual comparison operators.
- `like(left, pattern[, escape])` and `notLike(...)` wrap SQL pattern matching in an AST-safe way so you can filter by `%` or `_`.

### Logical connectors

- `and(...operands)` and `or(...operands)` combine other expressions without having to build the nodes manually.

### Null checks and membership

- `isNull(column)` / `isNotNull(column)` translate to `IS NULL` and `IS NOT NULL`.
- `inList(column, [values])` / `notInList(...)` build `IN`/`NOT IN` expressions from literal arrays or literal nodes.
- `inSubquery(column, query)` / `notInSubquery(...)` accept a `SelectQueryNode` or builder and emit `IN (subquery)` filters; pass a `SelectQueryBuilder` directly and it will call `getAST()` for you.

```ts
import { selectFrom, eq, inSubquery } from 'metal-orm';

const completedUserIds = selectFrom(Orders)
  .select({ userId: Orders.columns.user_id })
  .where(eq(Orders.columns.status, 'completed'));

const query = selectFrom(Users)
  .where(inSubquery(Users.columns.id, completedUserIds));
```

### Range, JSON, and conditional helpers

- `between(column, lower, upper)` and `notBetween(...)` map directly to `a BETWEEN b AND c` blocks.
- `jsonPath(column, '$.path')` drills into JSON/JSONB columns and can be combined with other helpers for filtering (e.g., `eq(jsonPath(...), 'dark')`).
- `caseWhen(conditions, elseValue?)` builds `CASE WHEN ... THEN ... ELSE ... END`. Each condition is an object with a `when` predicate and a `then` value.

### Subquery helpers

- `exists(subquery)` / `notExists(subquery)` wrap a `SelectQueryNode` to let you filter rows based on the presence of related data.

## Aggregate functions

Aggregate helpers all accept a column definition (or column node) and construct the matching function call:

- `count(column)` for `COUNT`.
- `sum(column)` for `SUM`.
- `avg(column)` for `AVG`.
- `min(column)` for `MIN`.
- `max(column)` for `MAX`.

Use them together with `groupBy()`/`having()` when you need aggregated summaries:

```ts
import { selectFrom, count, max, min, gt } from 'metal-orm';

// Users and Orders are table definitions created via `defineTable`.
const query = selectFrom(Users)
  .select({
    userId: Users.columns.id,
    orderCount: count(Orders.columns.id),
    largestOrder: max(Orders.columns.total),
    smallestOrder: min(Orders.columns.total)
  })
  .groupBy(Users.columns.id)
  .having(gt(count(Orders.columns.id), 3));
```

## Window functions

Window helpers automatically append `OVER (...)`. The built-in helpers are:

- `rowNumber()`, `rank()`, `denseRank()` for ordinal rankings.
- `ntile(n)` to bucket rows into `n` groups.
- `lag(column, offset = 1, defaultValue?)` and `lead(...)` to look at surrounding rows; the default offset is `1`, and you can pass a fallback value.
- `firstValue(column)` / `lastValue(column)` for boundary values within the frame.

If you need custom `PARTITION BY` or `ORDER BY` clauses, `windowFunction(name, args?, partitionBy?, orderBy?)` gives you full control without leaking SQL strings.

```ts
import {
  selectFrom,
  eq,
  and,
  gt,
  count,
  jsonPath,
  caseWhen,
  windowFunction,
  rowNumber,
  exists
} from 'metal-orm';

// Users, Posts, and Comments are table definitions created via `defineTable`.
const query = selectFrom(Users)
  .select({
    id: Users.columns.id,
    theme: jsonPath(Users.columns.preferences, '$.theme'),
    statusLabel: caseWhen([
      { when: eq(Users.columns.score, 0), then: 'New' },
      { when: gt(Users.columns.score, 5), then: 'Power User' }
    ], 'Regular'),
    rowNumber: rowNumber(),
    rankByRegion: windowFunction(
      'RANK',
      [],
      [Users.columns.region],
      [{ column: Users.columns.score, direction: 'DESC' }]
    ),
    totalPosts: count(Posts.columns.id)
  })
  .leftJoin(Posts, eq(Posts.columns.userId, Users.columns.id))
  .where(
    and(
      eq(Users.columns.active, true),
      gt(count(Posts.columns.id), 2),
      exists(
        selectFrom(Comments)
          .selectRaw('1')
          .where(eq(Comments.columns.postId, Posts.columns.id))
      )
    )
  )
  .groupBy(Users.columns.id);
```

The snippet above shows how to combine comparisons, JSON access, `caseWhen`, window functions, aggregates, and `exists` within a single query. Every helper is dialect-agnostic, so you can mix and match them without worrying about the underlying SQL syntax.
