# Query Builder

MetalORM's query builder provides a fluent and expressive API for constructing SQL queries.

## Selecting Data

You can build SELECT queries using the `selectFrom()` helper or construct a `SelectQueryBuilder` directly.

### Basic Selections

You can select all columns using `selectRaw('*')`, or use `select()` with column names when you just need a few fields:

```typescript
import { selectFrom } from 'metal-orm';

// Select all columns
const query = selectFrom(users).selectRaw('*');

// Select specific columns
const query = selectFrom(users).select('id', 'name');
```

When you need computed columns alongside root scalars, spread a `sel()` map into `select()` and add the extras manually (see the "Selection helpers" section below).

### Selection helpers

Use specialized helpers to keep selection maps concise while preserving typing:

- `select(...names)` builds typed selections for the root table.
- `sel(table, ...names)` returns a selection map you can spread inside `.select()` alongside computed fields.
- `selectRelationColumns` / `includePick` pull in a relation's columns and automatically add the necessary join.
- `selectColumnsDeep` fans out a config object across the root table and its relations.
- `esel(Entity, ...)` mirrors `sel` but starts from a decorator-bound entity class.

```typescript
import { selectFrom, sel, count } from 'metal-orm';

const query = selectFrom(users)
  .select({
    ...sel(users, 'id', 'name', 'email'),
    postCount: count(posts.columns.id),
  })
  .selectRelationColumns('posts', 'id', 'title')
  .includePick('posts', ['createdAt']);
```

Assuming `posts` is a related table on `users` (e.g. a `hasMany` or `hasOne`), the helpers above keep the AST typed without spelling `users.columns.*` repeatedly, and they automatically widen your joins so relations stay hydrated.

These helpers are the recommended way to build typed selections and to avoid repeating `table.columns.*` everywhere; keep using `table.columns` when defining schema metadata, constraints, or relations.

If you prefer direct column properties (and want `users.id` instead of `users.columns.id`), opt into a proxy reference:

```ts
import { tableRef, getColumn } from 'metal-orm';

const u = tableRef(users);

qb.where(eq(u.id, 1));

// Collisions (e.g. a column named "name"):
// - u.name is the *table name* (real field)
// - u.$.name is the "name" column
// - getColumn(u, 'name') also works for dynamic keys
```

For decorator-level entities, use [`entityRef()`](./api-reference.md:1) to get the same proxy behavior from a class constructor.

### Joins

You can join tables using `leftJoin`, `innerJoin`, `rightJoin`, etc.

```typescript
import { selectFrom, eq } from 'metal-orm';

const query = selectFrom(users)
  .select({
    userId: users.columns.id,
    postTitle: posts.columns.title,
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id));
```

### Function tables

When you need to treat a function that yields rows as a table source (e.g., `json_each`, `generate_series`, or custom stored procedures), use `fromFunctionTable()` to replace the root `FROM` with the function and `joinFunctionTable()` to add lateral joins. Both helpers accept the function name, operands, alias, and optional flags (lateral, WITH ORDINALITY, column aliases, schema) and they bridge to the same `fnTable()` AST builder used internally by the planner.

```typescript
import { selectFrom } from 'metal-orm';

const query = selectFrom(users)
  .fromFunctionTable('json_each', [{ type: 'Literal', value: '{"a":1}' }], 'je', {
    columnAliases: ['key', 'value']
  })
  .selectRaw('je.key', 'je.value');

const lateralQuery = selectFrom(users)
  .joinFunctionTable(
    'generate_series',
    [{ type: 'Literal', value: 1 }, { type: 'Literal', value: 10 }],
    'gs',
    { type: 'BinaryExpression', left: { type: 'Literal', value: 1 }, operator: '=', right: { type: 'Literal', value: 1 } },
    undefined,
    { lateral: true, withOrdinality: true }
  );
```

### Filtering

You can filter results using the `where()` method with expression helpers:

```typescript
import { selectFrom, and, like, gt } from 'metal-orm';

const query = selectFrom(users)
  .selectRaw('*')
  .where(and(
    like(users.columns.name, '%John%'),
    gt(users.columns.createdAt, new Date('2023-01-01'))
  ));
```

### Bitwise Operators

MetalORM supports standard bitwise operators across all dialects, including specific emulations where needed (like XOR for SQLite).

```typescript
import { selectFrom, bitAnd, bitOr, bitXor, shiftLeft, shiftRight } from 'metal-orm';

const query = selectFrom(users)
  .select({
    id: users.columns.id,
    maskedId: bitAnd(users.columns.id, 0xFF)
  })
  .where(bitOr(users.columns.flags, 1));
```

- **PostgreSQL**: XOR uses the `#` operator.
- **SQLite**: XOR is emulated using `(a | b) & ~(a & b)`.
- **MySQL & SQL Server**: Use the standard `^` for XOR.

### Aggregation

You can use aggregate functions like `count()`, `sum()`, `avg()`, etc., and group the results.

```typescript
import { selectFrom, count, eq, gt } from 'metal-orm';

const query = selectFrom(users)
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
import { selectFrom } from 'metal-orm';

const query = selectFrom(posts)
  .selectRaw('*')
  .orderBy(posts.columns.createdAt, 'DESC')
  .limit(10)
  .offset(20);
```

If you're using the Level 2 runtime (`OrmSession`), you can also use:

- `builder.count(session)` to count result rows
- `builder.executePaged(session, { page, pageSize })` to get `{ items, totalItems }`

### Window Functions

The query builder supports window functions for advanced analytics:

```typescript
import { selectFrom, rowNumber, rank } from 'metal-orm';

const query = selectFrom(users)
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
import { selectFrom, gt, eq } from 'metal-orm';

const activeUsers = selectFrom(users)
  .selectRaw('*')
  .where(gt(users.columns.lastLogin, new Date('2023-01-01')))
  .as('active_users');

const query = selectFrom(activeUsers)
  .with(activeUsers)
  .selectRaw('*')
  .where(eq(activeUsers.columns.id, 1));
```

### Subqueries

Support for subqueries in SELECT and WHERE clauses:

```typescript
import { selectFrom, count, eq } from 'metal-orm';

const subquery = selectFrom(posts)
  .select({ count: count(posts.columns.id) })
  .where(eq(posts.columns.userId, users.columns.id));

const query = selectFrom(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    postCount: subquery
  });
```

## From Builder to Entities

You can keep using the query builder on its own, or plug it into the entity runtime:

- `builder.compile(dialect)` → SQL + params → driver (builder-only usage).
- `builder.execute(session)` → entities tracked by an `OrmSession` (runtime usage).

See [Runtime & Unit of Work](./runtime.md) for how `execute(session)` integrates with entities and lazy relations.
