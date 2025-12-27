# Query Builder 🧩

MetalORM's `SelectQueryBuilder` provides a fluent, exceptionally strongly-typed API for constructing SQL queries. It operates on a real SQL AST, meaning no "magic" strings—every part of your query is represented by typed nodes.

## Preferred Selection Patterns

While you can access columns via `table.columns.*`, MetalORM provides higher-level patterns to keep your queries clean, readable, and typed.

### 1. Simple Selections with `select()`
For basic cases, just pass the column names as strings.
```ts
const query = selectFrom(users).select('id', 'name', 'email');
```

The builder result is typed to include the columns you explicitly pick, so `await query.execute(session)` automatically exposes `result[0].id`, `result[0].name`, etc., without needing casts. The same applies when you spread an array of column names into `.select(...)`.

> [!NOTE]
> When using `selectFromEntity(MyEntity)`, MetalORM automatically selects all columns by default. You only need `.select()` if you want to narrow the projection or add computed fields.

If you prefer to keep column lists in a reusable array or generate them at runtime, you can spread the array into `select()` because it accepts rest arguments:

```ts
const visibleColumns = ['id', 'name', 'email'] as const;
const query = selectFrom(users).select(...visibleColumns);
```

You can also select computed or aliased expressions by passing an object to `.select({ ... })`. The builder merges the resulting alias keys into the return type, so those computed fields become first-class properties on the hydrated rows.

### 2. The `sel()` and `esel()` Helpers (Recommended)
Use `sel()` for pure tables and `esel()` for decorator-based entities. These helpers build a typed selection map that you can spread inside `.select()`, allowing you to mix in computed fields easily.

```ts
import { selectFrom, sel, count, rowNumber } from 'metal-orm';

const u = sel(users, 'id', 'name');
const p = sel(posts, 'id', 'title');

const query = selectFrom(users)
  .select({
    ...u,
    postCount: count(p.id),
    rank: rowNumber(),
  })
  .leftJoin(posts, eq(p.userId, u.id))
  .groupBy(u.id, u.name);
```

### 3. Proxy Access with `tableRef()` and `entityRef()`
If you prefer property access (e.g., `u.id` instead of `users.columns.id`), use a ref proxy.

```ts
import { tableRef, eq } from 'metal-orm';

const u = tableRef(users);

const query = selectFrom(users)
  .select('id', 'name')
  .where(eq(u.id, 1));

// Tip: If a column name (like 'name') collides with a table property,
// use u.$.name to access the column definition.
```

---

## Selecting Data

### Basic & Raw Selections
- `select(...names)`: Selects specific columns from the root table.
- `selectRaw('*')`: Selects all columns (useful for quick debugging).
- `distinct(...cols)`: Adds a `DISTINCT` clause.

### Subqueries as Columns
Use `selectSubquery()` to pull a scalar value from another query.

```ts
const u = tableRef(users);
const p = tableRef(posts);

const sub = selectFrom(posts)
  .select({ count: count(p.id) })
  .where(eq(p.userId, u.id));

const query = selectFrom(users)
  .select('id', 'name')
  .selectSubquery('postCount', sub);
```

`selectSubquery(alias, query)` now carries the alias name into the builder result. If your subquery returns a known type (e.g., `number`), use the generic form or `asType<T>()` to keep TypeScript aware of the column's runtime type:

```ts
const totalSpentSub = selectFrom(orders)
  .select({ total: sum(orders.columns.total) })
  .where(eq(orders.columns.userId, users.columns.id));

const customers = await selectFrom(users)
  .select('id')
  .selectSubquery<number>('totalSpent', totalSpentSub)
  .execute(session);

const fullName = asType<string>(concat(users.columns.firstName, ' ', users.columns.lastName));

The `asType<T>(expr)` helper is exported alongside the other expression builders. It carries a compile-time-only `__tsType` tag so TypeScript knows the runtime shape of the projection without changing the generated SQL.
```

---

## Relationship Helpers

MetalORM understands your schema relations and provides helpers to automatically handle joins and hydration.

- `joinRelation(name, [kind], [extraCondition])`: Joins a related table.
- `include(name, [options])`: Joins and prepares the relation for hydration; use `options.columns` when you only need a subset of relation fields.
- `includePick(name, columns)`: A shortcut to `include` with the `columns` option.
- `includeLazy(name, [options])`: Marks a relation to be loaded lazily (only for Level 2 runtime).
- `match(name, [predicate])`: Matches records based on a relationship.

> **Typed includes:** If you assign relations after `defineTable`, prefer `setRelations(table, { ... })` (the same helper used in `tests/fixtures/schema.ts` and the new `tests/relations/include-typing-set-relations.test.ts`). That keeps relation metadata literal so TypeScript can validate `include(..., { columns: [...] })` and pivot columns, guarding against typos before you run the query.

```ts
const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const projects = defineTable('projects', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const projectAssignments = defineTable('project_assignments', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  project_id: col.int(),
});

setRelations(users, {
  projects: belongsToMany(projects, projectAssignments, {
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'project_id',
  }),
});

selectFrom(users)
  .include('projects', { columns: ['id', 'name'] });
```

After executing a query with `includeLazy`, the hydrated result behaves like any other array, so you can call `find()` or `map()` to inspect the loaded relations:

```ts
const lazyPosts = await selectFrom(posts)
  .select('id', 'title')
  .includeLazy('tags', { columns: ['label'] })
  .execute(session);

const analyticalPost = lazyPosts.find(post => post.title === 'Analytical Engine');
const tagLabels = analyticalPost?.tags.map(tag => tag.label) ?? [];
const titlesWithTags = lazyPosts.map(post => ({
  title: post.title,
  tags: post.tags.map(tag => tag.label)
}));
```

```ts
const u = sel(users, 'id', 'name');
const p = tableRef(posts);

const query = selectFrom(users)
  .select(u)
  .includePick('posts', ['id', 'title', 'createdAt'])
  .joinRelation('roles', 'LEFT')
  .whereHas('posts', q => q.where(gt(p.createdAt, '2023-01-01')));
```

### Include Filters & CTEs

When you filter an included relation (`include('relation', { filter: ... })`), MetalORM now hoists any predicate that only references the included table's columns into a dedicated Common Table Expression (CTE). The join then runs against `WITH "<relation>__filtered" AS (...)` and reuses the original table alias so hydration, column aliases, and eager loading still work predictably.

This hoisting is applied for nested includes and BelongsToMany targets as well: if the predicate only touches the related table (e.g., the `tags` table in a Post→Tag include) a CTE such as `tags__filtered` is created before the pivot joins, while filters that span the root, pivot, or other relations remain in the join `ON` clause. The same classification happens at every nested relation, so each include decides on the CTE path independently.

Filters that touch the root table, pivot tables, or other relations stay in the join `ON` clause to preserve correlation semantics, so keeping the predicate scoped to the relation's columns is the easiest way to get cleaner, composable SQL.

---

## Filtering

Use `where()` with a rich catalog of expression builders.

### Logical Operators
- `and(...exprs)`, `or(...exprs)`

### Comparison & Checks
- `eq(a, b)`, `neq(a, b)`
- `gt(a, b)`, `gte(a, b)`, `lt(a, b)`, `lte(a, b)`
- `isNull(a)`, `isNotNull(a)`
- `like(a, pattern)`, `notLike(a, pattern)`
- `between(a, lower, upper)`, `notBetween(a, lower, upper)`
- `inList(a, [values])`, `notInList(a, [values])`

### Existence Checks
- `whereExists(subquery)`
- `whereNotExists(subquery)`
- `whereHas(relationName, [callback])`
- `whereHasNot(relationName, [callback])`

---

## Advanced SQL Features

### CTEs (Common Table Expressions)
Organize complex logic into readable blocks with `with()` or `withRecursive()`.

```ts
const u = tableRef(users);
const p = tableRef(posts);

const recentPosts = selectFrom(posts)
  .select(p.id, p.userId)
  .where(gt(p.createdAt, '2024-01-01'))
  .as('recent');

const query = selectFrom(users)
  .with('recent_posts', recentPosts)
  .select(u.id, u.name)
  .innerJoin(recentPosts, eq(recentPosts.columns.userId, u.id));
```

### Window Functions
Perform complex analytics over partitions of your data.

```ts
import { rowNumber, rank, lag, lead, tableRef } from 'metal-orm';

const o = tableRef(orders);

const query = selectFrom(orders)
  .select({
    ...sel(orders, 'id', 'orderDate'),
    rowNum: rowNumber(),
    prevAmount: lag(o.amount),
  })
  .partitionBy(o.userId)
  .orderBy(o.orderDate, 'ASC');
```

### Set Operations
Combine multiple result sets using standard SQL operators.
- `union(query)`, `unionAll(query)`
- `intersect(query)`, `except(query)`

### Advanced Joins
- `joinSubquery(query, alias, condition, [kind])`: Join against a subquery.
- `joinFunctionTable(fnName, args, alias, condition, [kind])`: Join against row-yielding functions (e.g. `json_each`).

---

## SQL Function Catalog

MetalORM provides builders for hundreds of standard SQL functions, all dialect-aware.

- **Text**: `lower`, `upper`, `trim`, `concat`, `substr`, `replace`, `regexp`, etc.
- **Numeric**: `abs`, `round`, `ceil/floor`, `power`, `sqrt`, `log`, etc.
- **DateTime**: `now`, `currentDate`, `dateAdd`, `dateDiff`, `extract`, `age`, etc.
- **Control Flow**: `caseWhen`, `coalesce`, `nullif`, etc.

---

## Execution & Hydration

MetalORM separates query construction from execution.

### Level 1: Pure Query Building
Compile to SQL and run with any driver.
```ts
const { sql, params } = query.compile(new PostgresDialect());
```

### Level 2: Entity Runtime
Use `execute(session)` to get tracked entities and handle hydration.
```ts
const users = await query.execute(session);
```

### Pagination
Helpers for common paging patterns (requires Level 2 session).
- `builder.count(session)`: Returns total row count.
- `builder.executePaged(session, { page, pageSize })`: Returns `{ items, totalItems }`.

---

> [!TIP]
> This guide focuses on **Select** queries. For **Insert**, **Update**, and **Delete**, see [DML Operations](./dml-operations.md).
