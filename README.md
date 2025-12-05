# MetalORM ⚙️ - Type-safe SQL, layered ORM, decorator-based entities – all on the same core.

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

MetalORM is a TypeScript-first, AST-driven SQL toolkit you can dial up or down depending on how “ORM-y” you want to be:

- **Level 1 – Query builder & hydration 🧩**  
  Define tables with `defineTable` / `col.*`, build strongly-typed queries on a real SQL AST, and hydrate flat result sets into nested objects – no ORM runtime involved.
- **Level 2 – ORM runtime (entities + Unit of Work 🧠)**  
  Let `OrmContext` turn rows into tracked entities with lazy relations, cascades, and a [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work) that flushes changes with `saveChanges()`.
- **Level 3 – Decorator entities (classes + metadata ✨)**  
  Use `@Entity`, `@Column`, `@PrimaryKey`, relation decorators, `bootstrapEntities()` and `selectFromEntity()` to describe your model classes. MetalORM bootstraps schema & relations from metadata and plugs them into the same runtime and query builder.

Use only the layer you need in each part of your codebase.

---

<a id="table-of-contents"></a>
## Table of Contents 🧭

- [Documentation](#documentation)
- [Features](#features)
- [Installation](#installation)
- [Quick start - three levels](#quick-start)
  - [Level 1 – Query builder & hydration](#level-1)
  - [Level 2 – Entities + Unit of Work](#level-2)
  - [Level 3 – Decorator entities](#level-3)
- [When to use which level?](#when-to-use-which-level)
- [Design notes](#design-notes)
- [Contributing](#contributing)
- [License](#license)

---

<a id="documentation"></a>
## Documentation 📚

Full docs live in the `docs/` folder:

- [Introduction](https://github.com/celsowm/metal-orm/blob/main/docs/index.md)
- [Getting Started](https://github.com/celsowm/metal-orm/blob/main/docs/getting-started.md)
- [Level 3 Backend Tutorial](https://github.com/celsowm/metal-orm/blob/main/docs/level-3-backend-tutorial.md)
- [Schema Definition](https://github.com/celsowm/metal-orm/blob/main/docs/schema-definition.md)
- [Query Builder](https://github.com/celsowm/metal-orm/blob/main/docs/query-builder.md)
- [DML Operations](https://github.com/celsowm/metal-orm/blob/main/docs/dml-operations.md)
- [Hydration & Entities](https://github.com/celsowm/metal-orm/blob/main/docs/hydration.md)
- [Runtime & Unit of Work](https://github.com/celsowm/metal-orm/blob/main/docs/runtime.md)
- [Advanced Features](https://github.com/celsowm/metal-orm/blob/main/docs/advanced-features.md)
- [Multi-Dialect Support](https://github.com/celsowm/metal-orm/blob/main/docs/multi-dialect-support.md)
- [Schema Generation (DDL)](https://github.com/celsowm/metal-orm/blob/main/docs/schema-generation.md)
- [API Reference](https://github.com/celsowm/metal-orm/blob/main/docs/api-reference.md)

---

<a id="features"></a>
## Features 🚀

### Level 1 – Query builder & hydration

- **Declarative schema definition** with `defineTable`, `col.*`, and typed relations.
- **Fluent query builder** over a real SQL AST  
  (`SelectQueryBuilder`, `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder`).
- **Advanced SQL**: CTEs, aggregates, window functions, subqueries, JSON, CASE, EXISTS.
- **Set operations**: `union`, `unionAll`, `intersect`, `except` across all dialects (ORDER/LIMIT apply to the combined result; hydration is disabled for compound queries so rows are returned as-is without collapsing duplicates).
- **Expression builders**: `eq`, `and`, `or`, `between`, `inList`, `exists`, `jsonPath`, `caseWhen`, window functions like `rowNumber`, `rank`, `lag`, `lead`, etc., all backed by typed AST nodes.
- **Relation-aware hydration**: turn flat rows into nested objects (`user.posts`, `user.roles`, etc.) using a hydration plan derived from the AST metadata.
- **Multi-dialect**: compile once, run on MySQL/MariaDB, PostgreSQL, SQLite, or SQL Server via pluggable dialects.
- **DML**: type-safe INSERT / UPDATE / DELETE with `RETURNING` where supported.

Level 1 is ideal when you:

- Already have a domain model and just want a serious SQL builder.
- Want deterministic SQL (no magical query generation).
- Need to share the same AST across tooling (e.g. codegen, diagnostics, logging).

### Level 2 – ORM runtime (`OrmContext`)

On top of the query builder, MetalORM ships a focused runtime:

- **Entities inferred from your `TableDef`s** (no separate mapping file).
- **Lazy, batched relations**: `user.posts.load()`, `user.roles.syncByIds([...])`, etc.
- **Identity map**: the same row becomes the same entity instance within a context (see the [Identity map pattern](https://en.wikipedia.org/wiki/Identity_map_pattern)).
- **Unit of Work (`OrmContext`)** tracking New/Dirty/Removed entities and relation changes, inspired by the classic [Unit of Work pattern](https://en.wikipedia.org/wiki/Unit_of_work).
- **Graph persistence**: mutate a whole object graph and flush once with `ctx.saveChanges()`.
- **Relation change processor** that knows how to deal with has-many and many-to-many pivot tables.
- **Interceptors**: `beforeFlush` / `afterFlush` hooks for cross-cutting concerns (auditing, multi-tenant filters, soft delete filters, etc.).
- **Domain events**: `addDomainEvent` and a DomainEventBus integrated into `saveChanges()`, aligned with domain events from [Domain-driven design](https://en.wikipedia.org/wiki/Domain-driven_design).
- **JSON-safe entities**: relation wrappers hide internal references and implement `toJSON`, so `JSON.stringify` of hydrated entities works without circular reference errors.

Use this layer where:

- A request-scoped context fits (web/API handlers, jobs).
- You want change tracking, cascades, and relation helpers instead of manual SQL for every update.

### Level 3 – Decorator entities

If you like explicit model classes, you can add a thin decorator layer on top of the same schema/runtime:

- `@Entity()` on a class to derive and register a table name (by default snake_case plural of the class name, with an optional `tableName` override).
- `@Column(...)` and `@PrimaryKey(...)` on properties; decorators collect column metadata and later build `TableDef`s from it.
- Relation decorators:
  - `@HasMany({ target, foreignKey, ... })`
  - `@BelongsTo({ target, foreignKey, ... })`
  - `@BelongsToMany({ target, pivotTable, ... })`
- `bootstrapEntities()` scans metadata, builds `TableDef`s, wires relations with the same `hasMany` / `belongsTo` / `belongsToMany` helpers you would use manually, and returns the resulting tables.
- `selectFromEntity(MyEntity)` lets you start a `SelectQueryBuilder` directly from the class.

You don’t have to use decorators, but when you do, you’re still on the same AST + dialect + runtime foundation.

---

<a id="installation"></a>
## Installation 📦

```bash
# npm
npm install metal-orm

# yarn
yarn add metal-orm

# pnpm
pnpm add metal-orm
```

MetalORM compiles SQL; you bring your own driver:

| Dialect            | Driver    | Install                |
| ------------------ | --------- | ---------------------- |
| MySQL / MariaDB    | `mysql2`  | `npm install mysql2`   |
| SQLite             | `sqlite3` | `npm install sqlite3`  |
| PostgreSQL         | `pg`      | `npm install pg`       |
| SQL Server         | `tedious` | `npm install tedious`  |

Pick the matching dialect (`MySqlDialect`, `SQLiteDialect`, `PostgresDialect`, `MSSQLDialect`) when compiling queries.

> Drivers are declared as optional peer dependencies. Install only the ones you actually use in your project.

### Playground (optional) 🧪

The React playground lives in `playground/` and is no longer part of the published package or its dependency tree. To run it locally:

1. `cd playground && npm install`
2. `npm run dev` (uses the root `vite.config.ts`)

It boots against an in-memory SQLite database seeded from fixtures under `playground/shared/`.

---

<a id="quick-start"></a>
## Quick start – three levels

<a id="level-1"></a>
### Level 1: Query builder & hydration 🧩

#### 1. Tiny table, tiny query

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

#### 2. Relations & hydration (still no ORM)

Now add relations and get nested objects, still without committing to a runtime.

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

<a id="level-2"></a>
### Level 2: Entities + Unit of Work (ORM runtime) 🧠

When you're ready, you can let MetalORM manage entities and relations for you.

Instead of “naked objects”, your queries can return entities attached to an `OrmContext`:

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
  executor: {
    async executeSql(sql, params) {
      const [rows] = await connection.execute(sql, params);
      // MetalORM expects columns + values; adapt as needed
      return [{
        columns: Object.keys(rows[0] ?? {}),
        values: rows.map(row => Object.values(row)),
      }];
    },
    // Optional: if you want MetalORM to handle transactions around saveChanges()
    async beginTransaction() {
      await connection.beginTransaction();
    },
    async commitTransaction() {
      await connection.commit();
    },
    async rollbackTransaction() {
      await connection.rollback();
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

What the runtime gives you:

- [Identity map](https://en.wikipedia.org/wiki/Identity_map_pattern) (per context).
- [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work) style change tracking on scalar properties.
- Relation tracking (add/remove/sync on collections).
- Cascades on relations: `'all' | 'persist' | 'remove' | 'link'`.
- Single flush: `ctx.saveChanges()` figures out inserts, updates, deletes, and pivot changes.

<a id="level-3"></a>
### Level 3: Decorator entities ✨

Finally, you can describe your models with decorators and still use the same runtime and query builder.

> Import paths here assume a `metal-orm/decorators` subpath export – adjust if your bundle exposes them differently.

```ts
import mysql from 'mysql2/promise';
import { OrmContext, MySqlDialect, col } from 'metal-orm';
import {
  Entity,
  Column,
  PrimaryKey,
  HasMany,
  BelongsTo,
  bootstrapEntities,
  selectFromEntity,
} from 'metal-orm/decorators';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255).notNull())
  name!: string;

  @Column(col.varchar(255))
  email?: string;

  @HasMany({
    target: () => Post,
    foreignKey: 'userId',
  })
  posts!: any; // relation wrapper; type omitted for brevity
}

@Entity()
class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255).notNull())
  title!: string;

  @Column(col.int().notNull())
  userId!: number;

  @BelongsTo({
    target: () => User,
    foreignKey: 'userId',
  })
  user!: any;
}

// 1) Bootstrap metadata once at startup
const tables = bootstrapEntities();
// tables: TableDef[] – compatible with the rest of MetalORM

// 2) Create OrmContext as before
const connection = await mysql.createConnection({ /* ... */ });

const ctx = new OrmContext({
  dialect: new MySqlDialect(),
  executor: {
    async executeSql(sql, params) {
      const [rows] = await connection.execute(sql, params);
      return [{
        columns: Object.keys(rows[0] ?? {}),
        values: rows.map(row => Object.values(row)),
      }];
    },
  },
});

// 3) Query starting from the entity class
const [user] = await selectFromEntity(User)
  .select({
    id: User.prototype.id,   // or map to columns by name/alias as you prefer
    name: User.prototype.name,
  })
  .includeLazy('posts')
  .where(/* same eq()/and() API as before */)
  .execute(ctx);

user.posts.add({ title: 'From decorators' });
await ctx.saveChanges();
```

This level is nice when:

- You want classes as your domain model, but don’t want a separate schema DSL.
- You like decorators for explicit mapping but still want AST-first SQL and a disciplined runtime.

---

<a id="when-to-use-which-level"></a>
## When to use which level? 🤔

- **Query builder + hydration (Level 1)**  
  Great for reporting/analytics, existing codebases with their own models, and services that need strong SQL but minimal runtime magic.

- **ORM runtime (Level 2)**  
  Great for request-scoped application logic and domain modeling where lazy relations, cascades, and graph persistence pay off.

- **Decorator entities (Level 3)**  
  Great when you want class-based entities and decorators, but still want to keep the underlying architecture explicit and layered.

All three levels share the same schema, AST, and dialects, so you can mix them as needed and migrate gradually.

---

<a id="design-notes"></a>
## Design notes 🧱

Under the hood, MetalORM leans on well-known patterns:

- **AST + dialect abstraction**: SQL is modeled as typed AST nodes, compiled by dialects that you can extend.
- **Separation of concerns**: schema, AST, SQL compilation, execution, and ORM runtime are separate layers.
- **Unit of Work + Identity Map**: `OrmContext` coordinates changes and enforces one entity instance per row, following the [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work) and [Identity map](https://en.wikipedia.org/wiki/Identity_map_pattern) patterns.
- **Domain events + interceptors**: decouple side-effects from persistence and let cross-cutting concerns hook into flush points, similar in spirit to domain events in [Domain-driven design](https://en.wikipedia.org/wiki/Domain-driven_design).

You can stay at the low level (just AST + dialects) or adopt the higher levels when it makes your code simpler.

---

<a id="contributing"></a>
## Contributing 🤝

Issues and PRs are welcome! If you're interested in pushing the runtime/ORM side further (soft deletes, multi-tenant filters, outbox patterns, etc.), contributions are especially appreciated.

See the contributing guide for details.

---

<a id="license"></a>
## License 📄

MetalORM is MIT licensed.
