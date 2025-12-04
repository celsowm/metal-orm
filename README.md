# MetalORM

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

**Start as a type-safe SQL query builder. Grow into a full ORM with entities and a Unit of Work.**

MetalORM is a TypeScript-first, AST-driven SQL toolkit:

- At the **base level**, it's a clear, deterministic query builder with schema definitions and relation-aware hydration.
- At the **next level**, it becomes an **ORM runtime** with entities, lazy/batched relations, and a Unit of Work (`OrmContext`) that flushes graph changes in one `saveChanges()`.

Use only the parts you need: query builder + hydration for read-heavy/reporting code, or the full ORM runtime for application/business logic.

---

## Documentation

Full docs live in the `docs/` folder:

- [Introduction](https://github.com/celsowm/metal-orm/blob/main/docs/index.md)
- [Getting Started](https://github.com/celsowm/metal-orm/blob/main/docs/getting-started.md)
- [Schema Definition](https://github.com/celsowm/metal-orm/blob/main/docs/schema-definition.md)
- [Query Builder](https://github.com/celsowm/metal-orm/blob/main/docs/query-builder.md)
- [DML Operations](https://github.com/celsowm/metal-orm/blob/main/docs/dml-operations.md)
- [Hydration & Entities](https://github.com/celsowm/metal-orm/blob/main/docs/hydration.md)
- [Runtime & Unit of Work](https://github.com/celsowm/metal-orm/blob/main/docs/runtime.md)
- [Advanced Features](https://github.com/celsowm/metal-orm/blob/main/docs/advanced-features.md)
- [Multi-Dialect Support](https://github.com/celsowm/metal-orm/blob/main/docs/multi-dialect-support.md)
- [API Reference](https://github.com/celsowm/metal-orm/blob/main/docs/api-reference.md)

---

## Features

**As a query builder:**

- **Declarative schema definition** with `defineTable`, `col.*`, and typed relations.
- **Fluent query builder** over a real SQL AST (`SelectQueryBuilder`, `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder`).
- **Advanced SQL**: CTEs, aggregates, window functions, subqueries, JSON, CASE, EXISTS.
- **Relation hydration**: turn flat rows into nested objects (`user.posts`, `user.roles`, etc.).
- **Multi-dialect**: compile once, run on MySQL, PostgreSQL, SQLite, or SQL Server.
- **DML**: type-safe INSERT / UPDATE / DELETE with `RETURNING` where supported.

**As an ORM runtime (optional):**

- **Entities** inferred from your `TableDef`s.
- **Lazy, batched relations**: `user.posts.load()`, `user.roles.load()`, etc.
- **Unit of Work (`OrmContext`)** tracking New/Dirty/Removed entities.
- **Graph persistence**: modify a whole object graph and flush with `ctx.saveChanges()`.
- **Hooks & domain events** for cross-cutting concerns (audit, outbox, etc.).

---

## Installation

```bash
# npm
npm install metal-orm

# yarn
yarn add metal-orm

# pnpm
pnpm add metal-orm
```

MetalORM compiles SQL; you bring your own driver:

| Dialect | Driver | Install |
| --- | --- | --- |
| MySQL / MariaDB | `mysql2` | `npm install mysql2` |
| SQLite | `sqlite3` | `npm install sqlite3` |
| PostgreSQL | `pg` | `npm install pg` |
| SQL Server | `tedious` | `npm install tedious` |

Pick the matching dialect (MySqlDialect, SQLiteDialect, PostgresDialect, MSSQLDialect) when compiling queries.

> Drivers are declared as optional peer dependencies. Install only the ones you actually use in your project.

### Playground (optional)

The React playground lives in `playground/` and is no longer part of the published package or its dependency tree. To run it locally:

1. `cd playground && npm install`
2. `npm run dev` (uses the root `vite.config.ts`)

It boots against an in-memory SQLite database seeded from the fixtures under `playground/shared/`.

## Quick start

1. Start simple: tiny table, tiny query

MetalORM can be just a straightforward query builder.

```ts
import mysql from 'mysql2/promise';
import {
  defineTable,
  col,
  SelectQueryBuilder,
  eq,
  MySqlDialect,
} from 'metal-orm';

// 1) A very small table
const todos = defineTable('todos', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  done: col.boolean().default(false),
});

// 2) Build a simple query
const listOpenTodos = new SelectQueryBuilder(todos)
  .select({
    id: todos.columns.id,
    title: todos.columns.title,
    done: todos.columns.done,
  })
  .where(eq(todos.columns.done, false))
  .orderBy(todos.columns.id, 'ASC');

// 3) Compile to SQL + params
const dialect = new MySqlDialect();
const { sql, params } = listOpenTodos.compile(dialect);

// 4) Run with your favorite driver
const connection = await mysql.createConnection({ /* ... */ });
const [rows] = await connection.execute(sql, params);

console.log(rows);
// [
//   { id: 1, title: 'Write docs', done: 0 },
//   { id: 2, title: 'Ship feature', done: 0 },
// ]
```


That’s it: schema, query, SQL, done.

2. Relations & hydration: nested results without an ORM

Now let's add relations and get nested objects, still without committing to a full ORM.

```ts
import {
  defineTable,
  col,
  hasMany,
  SelectQueryBuilder,
  eq,
  count,
  rowNumber,
  hydrateRows,
} from 'metal-orm';

const posts = defineTable('posts', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  userId: col.int().notNull(),
  createdAt: col.timestamp().default('CURRENT_TIMESTAMP'),
});

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
  email: col.varchar(255).unique(),
}, {
  posts: hasMany(posts, 'userId'),
});

// Build a query with relation & window function
const builder = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    email: users.columns.email,
    postCount: count(posts.columns.id),
    rank: rowNumber(),           // window function helper
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .groupBy(users.columns.id, users.columns.name, users.columns.email)
  .orderBy(count(posts.columns.id), 'DESC')
  .limit(10)
  .include('posts', {
    columns: [posts.columns.id, posts.columns.title, posts.columns.createdAt],
  }); // eager relation for hydration

const { sql, params } = builder.compile(dialect);
const [rows] = await connection.execute(sql, params);

// Turn flat rows into nested objects
const hydrated = hydrateRows(
  rows as Record<string, unknown>[],
  builder.getHydrationPlan(),
);

console.log(hydrated);
// [
//   {
//     id: 1,
//     name: 'John Doe',
//     email: 'john@example.com',
//     postCount: 15,
//     rank: 1,
//     posts: [
//       { id: 101, title: 'Latest Post', createdAt: '2023-05-15T10:00:00Z' },
//       // ...
//     ],
//   },
//   // ...
// ]
```


Use this mode anywhere you want powerful SQL + nice nested results, without changing how you manage your models.

3. Turn it up: entities + Unit of Work (ORM mode)

When you're ready, you can let MetalORM manage entities and relations for you.

Instead of "naked objects", your queries can return entities attached to an OrmContext:

```ts
import {
  OrmContext,
  MySqlDialect,
  SelectQueryBuilder,
  eq,
} from 'metal-orm';

// 1) Create an OrmContext for this request
const ctx = new OrmContext({
  dialect: new MySqlDialect(),
  db: {
    async executeSql(sql, params) {
      const [rows] = await connection.execute(sql, params);
      // MetalORM expects columns + values; adapt as needed
      return [{
        columns: Object.keys(rows[0] ?? {}),
        values: rows.map(row => Object.values(row)),
      }];
    },
  },
});

// 2) Load entities with lazy relations
const [user] = await new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    email: users.columns.email,
  })
  .includeLazy('posts')  // HasMany as a lazy collection
  .includeLazy('roles')  // BelongsToMany as a lazy collection
  .where(eq(users.columns.id, 1))
  .execute(ctx);

// user is an Entity<typeof users>
// scalar props are normal:
user.name = 'Updated Name';  // marks entity as Dirty

// relations are live collections:
const postsCollection = await user.posts.load(); // batched lazy load
const newPost = user.posts.add({ title: 'Hello from ORM mode' });

// Many-to-many via pivot:
await user.roles.syncByIds([1, 2, 3]);

// 3) Persist the entire graph
await ctx.saveChanges();
// INSERT/UPDATE/DELETE + pivot updates happen in a single Unit of Work.
```


Here's what the runtime gives you:

- Identity map: the same row becomes the same entity instance within a context.
- Change tracking: field writes mark entities as dirty.
- Relation tracking: add/remove/sync on relation collections emits relation changes.
- Cascades: relation definitions can opt into cascade: 'all' | 'persist' | 'remove' | 'link'.
- Single flush: `ctx.saveChanges()` figures out inserts, updates, deletes, and pivot changes.

You can start your project using only the query builder + hydration and gradually migrate hot paths to entities as you implement the runtime primitives.

## When to use which mode?

### Query builder + hydration only

Great for reporting, analytics, and places where you already have a model layer.

You keep full control over how objects map to rows.

### Entity + Unit of Work runtime

Great for request-scoped application logic and domain modeling.

You want lazy relations, cascades, and less boilerplate around update/delete logic.

Both modes share the same schema, AST, and dialects, so you don't have to pick one forever.

## Contributing

Issues and PRs are welcome! If you're interested in pushing the runtime/ORM side further (soft deletes, multi-tenant filters, outbox patterns, etc.), contributions are especially appreciated.

See the contributing guide for details.

## License

MetalORM is MIT licensed.
