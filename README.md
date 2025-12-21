# MetalORM ⚙️

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

> **TypeScript-first ORM that adapts to your needs**: use it as a type-safe query builder, a full-featured ORM runtime, or anything in between.

## Why MetalORM? 💡

- 🎯 **Gradual adoption**: Start with just SQL building, add ORM features when you need them
- 🔒 **Exceptionally strongly typed**: Built with TypeScript generics and type inference—**zero** `any` types in the entire codebase
- 🏗️ **Well-architected**: Implements proven design patterns (Strategy, Visitor, Builder, Unit of Work, Identity Map, Interceptor, and more)
- 🎨 **One AST, multiple levels**: All features share the same SQL AST foundation—no magic, just composable layers
- 🚀 **Multi-dialect from the start**: MySQL, PostgreSQL, SQLite, SQL Server support built-in

---

## ⚡ 30-Second Quick Start

```ts
import { defineTable, col, selectFrom, MySqlDialect } from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const query = selectFrom(users).select('id', 'name').limit(10);
const { sql, params } = query.compile(new MySqlDialect());
// That's it! Use sql + params with any driver.
// ↑ Fully typed—no casting, no 'any', just strong types all the way down
```

---

## Three Levels of Abstraction

MetalORM is a TypeScript-first, AST-driven SQL toolkit you can dial up or down depending on how "ORM-y" you want to be:

- **Level 1 – Query builder & hydration 🧩**  
  Define tables with `defineTable` / `col.*`, build strongly-typed queries on a real SQL AST, and hydrate flat result sets into nested objects – no ORM runtime involved.
  
- **Level 2 – ORM runtime (entities + Unit of Work 🧠)**  
  Let `OrmSession` (created from `Orm`) turn rows into tracked entities with lazy relations, cascades, and a [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work) that flushes changes with `session.commit()`.
  
- **Level 3 – Decorator entities (classes + metadata ✨)**  
  Use `@Entity`, `@Column`, `@PrimaryKey`, relation decorators, `bootstrapEntities()` (or the lazy bootstrapping in `getTableDefFromEntity` / `selectFromEntity`) to describe your model classes. MetalORM bootstraps schema & relations from metadata and plugs them into the same runtime and query builder.

**Use only the layer you need in each part of your codebase.**

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
- [Design & Architecture](#design-notes)
- [FAQ](#frequently-asked-questions-)
- [Performance & Production](#performance--production-)
- [Community & Support](#community--support-)
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
- [Save Graph](https://github.com/celsowm/metal-orm/blob/main/docs/save-graph.md)
- [Advanced Features](https://github.com/celsowm/metal-orm/blob/main/docs/advanced-features.md)
- [Multi-Dialect Support](https://github.com/celsowm/metal-orm/blob/main/docs/multi-dialect-support.md)
- [Schema Generation (DDL)](https://github.com/celsowm/metal-orm/blob/main/docs/schema-generation.md)
- [API Reference](https://github.com/celsowm/metal-orm/blob/main/docs/api-reference.md)
- [DB ➜ TS Type Mapping](https://github.com/celsowm/metal-orm/blob/main/docs/db-to-ts-types.md)

---

<a id="features"></a>
## Features 🚀

### Level 1 – Query builder & hydration

- **Declarative schema definition** with `defineTable`, `col.*`, and typed relations.
- **Typed temporal columns**: `col.date()` / `col.datetime()` / `col.timestamp()` default to `string` but accept a generic when your driver returns `Date` (e.g. `col.date<Date>()`).
- **Fluent query builder** over a real SQL AST  
  (`SelectQueryBuilder`, `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder`).
- **Advanced SQL**: CTEs, aggregates, window functions, subqueries, bitwise operators (`&`, `|`, `^`, `<<`, `>>`), JSON, CASE, EXISTS, and the full SQL function catalog (e.g. `STDDEV`, `VARIANCE`, `LOG2`, `CBRT`, `COALESCE`, `NULLIF`, `GREATEST`, `LEAST`, `IFNULL`, `LOCALTIME`, `LOCALTIMESTAMP`, `AGE`).
- **Table-valued functions**: use the new `tvf(key, …)` helper when you want portable intents such as `ARRAY_UNNEST`, letting the dialects’ `TableFunctionStrategy` renderers emit dialect-specific syntax (`LATERAL`/`WITH ORDINALITY`, alias validation, quoting, etc.). `fnTable()` remains available as the raw escape hatch when you need to emit a specific SQL function directly.
- **String helpers**: `lower`, `upper`, `trim`, `ltrim/rtrim`, `concat/concatWs`, `substr/left/right`, `position/instr/locate`, `replace`, `repeat`, `lpad/rpad`, `space`, and more with dialect-aware rendering.
- **Set operations**: `union`, `unionAll`, `intersect`, `except` across all dialects (ORDER/LIMIT apply to the combined result; hydration is disabled for compound queries so rows are returned as-is without collapsing duplicates).
- **Expression builders**: `eq`, `and`, `or`, `between`, `inList`, `exists`, `jsonPath`, `caseWhen`, window functions like `rowNumber`, `rank`, `lag`, `lead`, etc., all backed by typed AST nodes.
- **Relation-aware hydration**: turn flat rows into nested objects (`user.posts`, `user.roles`, etc.) using a hydration plan derived from the AST metadata.
- **Multi-dialect**: compile once, run on MySQL/MariaDB, PostgreSQL, SQLite, or SQL Server via pluggable dialects.
- **DML**: type-safe INSERT / UPDATE / DELETE with `RETURNING` where supported.

Level 1 is ideal when you:

- Already have a domain model and just want a serious SQL builder.
- Want deterministic SQL (no magical query generation).
- Need to share the same AST across tooling (e.g. codegen, diagnostics, logging).

### Level 2 – ORM runtime (`OrmSession`)

On top of the query builder, MetalORM ships a focused runtime managed by `Orm` and its request-scoped `OrmSession`s:

- **Entities inferred from your `TableDef`s** (no separate mapping file).
- **Lazy, batched relations**: `user.posts.load()`, `user.roles.syncByIds([...])`, etc.
- **Scoped transactions**: `session.transaction(async s => { ... })` wraps `begin/commit/rollback` on the existing executor; `Orm.transaction` remains available when you want a fresh transactional executor per call.
- **Identity map**: the same row becomes the same entity instance within a session (see the [Identity map pattern](https://en.wikipedia.org/wiki/Identity_map_pattern)).
- **Unit of Work (`OrmSession`)** tracking New/Dirty/Removed entities and relation changes, inspired by the classic [Unit of Work pattern](https://en.wikipedia.org/wiki/Unit_of_work).
- **Graph persistence**: mutate a whole object graph and flush once with `session.commit()`.
- **Relation change processor** that knows how to deal with has-many and many-to-many pivot tables.
- **Interceptors**: `beforeFlush` / `afterFlush` hooks for cross-cutting concerns (auditing, multi-tenant filters, soft delete filters, etc.).
- **Domain events**: `addDomainEvent` and a DomainEventBus integrated into `session.commit()`, aligned with domain events from [Domain-driven design](https://en.wikipedia.org/wiki/Domain-driven_design).
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
- `@HasOne({ target, foreignKey, ... })`
- `@BelongsTo({ target, foreignKey, ... })`
- `@BelongsToMany({ target, pivotTable, ... })`
- `bootstrapEntities()` scans metadata, builds `TableDef`s, wires relations with the same `hasOne` / `hasMany` / `belongsTo` / `belongsToMany` helpers you would use manually, and returns the resulting tables. (If you forget to call it, `getTableDefFromEntity` / `selectFromEntity` will bootstrap lazily on first use, but bootstrapping once at startup lets you reuse the same table defs and generate schema SQL.)
- `selectFromEntity(MyEntity)` lets you start a `SelectQueryBuilder` directly from the class.
- **Generate entities from an existing DB**: `npx metal-orm-gen -- --dialect=postgres --url=$DATABASE_URL --schema=public --out=src/entities.ts` introspects your schema and spits out `@Entity` / `@Column` classes you can immediately `bootstrapEntities()` with.

You don’t have to use decorators, but when you do, you’re still on the same AST + dialect + runtime foundation.

---

<a id="installation"></a>
## Installation 📦

**Requirements:** Node.js ≥ 20.0.0. For TypeScript projects, use TS 5.6+ to get the standard decorators API and typings.

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
  tableRef,
  col,
  selectFrom,
  eq,
  MySqlDialect,
} from 'metal-orm';

// 1) A very small table
const todos = defineTable('todos', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  done: col.boolean(),
});
// Add constraints
todos.columns.title.notNull = true;
todos.columns.done.default = false;

// Optional: opt-in ergonomic column access
const t = tableRef(todos);

// 2) Build a simple query
const listOpenTodos = selectFrom(todos)
  .select('id', 'title', 'done')
  .where(eq(t.done, false))
  .orderBy(t.id, 'ASC');

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

If you keep a reusable array of column names (e.g. shared across helpers or pulled from config), you can spread it into `.select(...)` since the method accepts rest arguments:

```ts
const defaultColumns = ['id', 'title', 'done'] as const;
const listOpenTodos = selectFrom(todos).select(...defaultColumns);
```

That's it: schema, query, SQL, done.

If you are using the Level 2 runtime (`OrmSession`), `SelectQueryBuilder` also provides `count(session)` and `executePaged(session, { page, pageSize })` for common pagination patterns.

#### Column pickers (preferred selection helpers)

`defineTable` still exposes the full `table.columns` map for schema metadata and constraint tweaks, but modern queries usually benefit from higher-level helpers instead of spelling `todo.columns.*` everywhere.

```ts
const t = tableRef(todos);

const listOpenTodos = selectFrom(todos)
  .select('id', 'title', 'done') // typed shorthand for the same fields
  .where(eq(t.done, false))
  .orderBy(t.id, 'ASC');
```

`select`, `include` (with `columns`), `includePick`, `selectColumnsDeep`, the `sel()` helpers for tables, and `esel()` for entities all build typed selection maps without repeating `table.columns.*`. Use those helpers when building query selections and reserve `table.columns.*` for schema definition, relations, or rare cases where you need a column reference outside of a picker. See the [Query Builder docs](./docs/query-builder.md#selection-helpers) for the reference, examples, and best practices for these helpers.

#### Ergonomic column access (opt-in) with `tableRef`

If you still want the convenience of accessing columns without spelling `.columns`, you can opt-in with `tableRef()`:

```ts
import { tableRef, eq, selectFrom } from 'metal-orm';

// Existing style (always works)
const listOpenTodos = selectFrom(todos)
  .select('id', 'title', 'done')
  .where(eq(todos.columns.done, false))
  .orderBy(todos.columns.id, 'ASC');

// Opt-in ergonomic style
const t = tableRef(todos);

const listOpenTodos2 = selectFrom(todos)
  .select('id', 'title', 'done')
  .where(eq(t.done, false))
  .orderBy(t.id, 'ASC');
```

Collision rule: real table fields win.

- `t.name` is the table name (string)
- `t.$.name` is the column definition for a colliding column name (escape hatch)

#### 2. Relations & hydration (still no ORM)

Now add relations and get nested objects, still without committing to a runtime.

```ts
import {
  defineTable,
  col,
  hasMany,
  selectFrom,
  eq,
  count,
  rowNumber,
  MySqlDialect,
  sel,
  hydrateRows,
} from 'metal-orm';

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  userId: col.int(),
  createdAt: col.timestamp(),
});

// Add constraints
posts.columns.title.notNull = true;
posts.columns.userId.notNull = true;

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
});

// Add relations and constraints
users.relations = {
  posts: hasMany(posts, 'userId'),
};
users.columns.name.notNull = true;
users.columns.email.unique = true;

// Build a query with relation & window function
const u = sel(users, 'id', 'name', 'email');
const p = sel(posts, 'id', 'userId');

const builder = selectFrom(users)
  .select({
    ...u,
    postCount: count(p.id),
    rank: rowNumber(), // window function helper
  })
  .leftJoin(posts, eq(p.userId, u.id))
  .groupBy(u.id)
  .groupBy(u.name)
  .groupBy(u.email)
  .orderBy(count(p.id), 'DESC')
  .limit(10)
  .includePick('posts', ['id', 'title', 'createdAt']); // eager relation for hydration

const dialect = new MySqlDialect();
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

Instead of “naked objects”, your queries can return entities attached to an `OrmSession`:

```ts
import mysql from 'mysql2/promise';
import {
  Orm,
  OrmSession,
  MySqlDialect,
  selectFrom,
  eq,
  tableRef,
  createMysqlExecutor,
} from 'metal-orm';

// 1) Create an Orm + session for this request

const connection = await mysql.createConnection({ /* ... */ });
const executor = createMysqlExecutor(connection);
const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => {},
  },
});
const session = new OrmSession({ orm, executor });

const u = tableRef(users);

// 2) Load entities with lazy relations
const [user] = await selectFrom(users)
  .select('id', 'name', 'email')
  .includeLazy('posts')  // HasMany as a lazy collection
  .includeLazy('roles')  // BelongsToMany as a lazy collection
  .where(eq(u.id, 1))
  .execute(session);

// user is an EntityInstance<typeof users>
// scalar props are normal:
user.name = 'Updated Name';  // marks entity as Dirty

// relations are live collections:
const postsCollection = await user.posts.load(); // batched lazy load
const newPost = user.posts.add({ title: 'Hello from ORM mode' });

// Many-to-many via pivot:
await user.roles.syncByIds([1, 2, 3]);

// 3) Persist the entire graph
await session.commit();
// INSERT/UPDATE/DELETE + pivot updates happen in a single Unit of Work.
```

What the runtime gives you:

- [Identity map](https://en.wikipedia.org/wiki/Identity_map_pattern) (per context).
- [Unit of Work](https://en.wikipedia.org/wiki/Unit_of_work) style change tracking on scalar properties.
- Relation tracking (add/remove/sync on collections).
- Cascades on relations: `'all' | 'persist' | 'remove' | 'link'`.
- Single flush: `session.commit()` figures out inserts, updates, deletes, and pivot changes.
- Column pickers to stay DRY: `select` on the root table, `include` (with `columns`) or `includePick` on relations, and `selectColumnsDeep` or the `sel`/`esel` helpers to build typed selection maps without repeating `table.columns.*`.
- Tip: if you assign relations after `defineTable`, use `setRelations(table, { ... })` so TypeScript can validate `include(..., { columns: [...] })` and pivot columns. See `docs/query-builder.md`.

<a id="level-3"></a>
### Level 3: Decorator entities ✨

Finally, you can describe your models with decorators and still use the same runtime and query builder.

The decorator layer is built on the TC39 Stage 3 standard (TypeScript 5.6+), so you simply decorate class fields (or accessors if you need custom logic) and the standard `ClassFieldDecoratorContext` keeps a metadata bag on `context.metadata`/`Symbol.metadata`. `@Entity` reads that bag when it runs and builds your `TableDef`s—no `experimentalDecorators`, parameter decorators, or extra polyfills required.

```ts
import mysql from 'mysql2/promise';
import {
  Orm,
  OrmSession,
  MySqlDialect,
  col,
  createMysqlExecutor,
  Entity,
  Column,
  PrimaryKey,
  HasMany,
  BelongsTo,
  bootstrapEntities,
  selectFromEntity,
  entityRef,
  eq,
} from 'metal-orm';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
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

  @Column(col.varchar(255))
  title!: string;

  @Column(col.int())
  userId!: number;

  @BelongsTo({
    target: () => User,
    foreignKey: 'userId',
  })
  user!: any;
}

// 1) Bootstrap metadata once at startup (recommended so you reuse the same TableDefs)
const tables = bootstrapEntities(); // getTableDefFromEntity/selectFromEntity can bootstrap lazily if you forget
// tables: TableDef[] – compatible with the rest of MetalORM

// 2) Create an Orm + session
const connection = await mysql.createConnection({ /* ... */ });
const executor = createMysqlExecutor(connection);
const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => {},
  },
});
const session = new OrmSession({ orm, executor });

// 3) Query starting from the entity class
const U = entityRef(User);
const [user] = await selectFromEntity(User)
  .select('id', 'name')
  .includeLazy('posts')
  .where(eq(U.id, 1))
  .execute(session);

user.posts.add({ title: 'From decorators' });
await session.commit();
```

Tip: to keep selections terse, use `select`, `include` (with `columns`), or the `sel`/`esel` helpers instead of spelling `table.columns.*` over and over.

This level is nice when:

- You want classes as your domain model, but don't want a separate schema DSL.
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
## Design & Architecture 🏗️

MetalORM is built on solid software engineering principles and proven design patterns.

### Architecture Layers

```
┌─────────────────────────────────────────────────┐
│              Your Application                   │
└─────────────────────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐      ┌──────────┐      ┌──────────┐
│ Level 1 │      │ Level 2  │      │ Level 3  │
│ Query   │◄─────┤   ORM    │◄─────┤Decorators│
│ Builder │      │ Runtime  │      │          │
└─────────┘      └──────────┘      └──────────┘
    │                  │                  │
    └──────────────────┼──────────────────┘
                       ▼
              ┌────────────────┐
              │   SQL AST      │
              │ (Typed Nodes)  │
              └────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│          Strategy Pattern: Dialects            │
│  MySQL | PostgreSQL | SQLite | SQL Server      │
└────────────────────────────────────────────────┘
                       ▼
              ┌────────────────┐
              │   Database     │
              └────────────────┘
```

### Design Patterns

- **Strategy Pattern**: Pluggable dialects (MySQL, PostgreSQL, SQLite, SQL Server) and function renderers allow the same query to target different databases
- **Visitor Pattern**: AST traversal for SQL compilation and expression processing
- **Builder Pattern**: Fluent query builders (Select, Insert, Update, Delete) for constructing queries step-by-step
- **Factory Pattern**: Dialect factory and executor creation abstract instantiation logic
- **Unit of Work**: Change tracking and batch persistence in `OrmSession` coordinate all modifications
- **Identity Map**: One entity instance per row within a session prevents duplicate object issues
- **Interceptor/Pipeline**: Query interceptors and flush lifecycle hooks enable cross-cutting concerns
- **Adapter Pattern**: Connection pooling adapters allow different pool implementations

### Type Safety

- **Zero `any` types**: The entire src codebase contains zero `any` types—every value is properly typed
- **100% typed public API**: Every public method, parameter, and return value is fully typed
- **Full type inference**: From schema definition through query building to result hydration
- **Compile-time safety**: Catch SQL errors at TypeScript compile time, not runtime
- **Generic-driven**: Leverages TypeScript generics extensively for type propagation

### Separation of Concerns

Each layer has a clear, focused responsibility:

- **Core AST layer**: SQL representation independent of any specific dialect
- **Dialect layer**: Vendor-specific SQL compilation (MySQL, PostgreSQL, etc.)
- **Schema layer**: Table and column definitions with relations
- **Query builder layer**: Fluent API for building type-safe queries
- **Hydration layer**: Transforms flat result sets into nested object graphs
- **ORM runtime layer**: Entity management, change tracking, lazy relations, transactions

You can use just the layers you need and stay at the low level (AST + dialects) or adopt higher levels when beneficial.

---

## Frequently Asked Questions ❓

**Q: How does MetalORM differ from other ORMs?**  
A: MetalORM's unique three-level architecture lets you choose your abstraction level—use just the query builder, add the ORM runtime when needed, or go full decorator-based entities. This gradual adoption path is uncommon in the TypeScript ecosystem. You're not locked into an all-or-nothing ORM approach.

**Q: Can I use this in production?**  
A: Yes! MetalORM is designed for production use with robust patterns like Unit of Work, Identity Map, and connection pooling support. The type-safe query builder ensures SQL correctness at compile time.

**Q: Do I need to use all three levels?**  
A: No! Use only what you need. Many projects stay at Level 1 (query builder) for its type-safe SQL building without any ORM overhead. Add runtime features (Level 2) or decorators (Level 3) only where they provide value.

**Q: What about migrations?**  
A: MetalORM provides schema generation via DDL builders. See the [Schema Generation docs](./docs/schema-generation.md) for details on generating CREATE TABLE statements from your table definitions.

**Q: How type-safe is it really?**  
A: Exceptionally. The entire codebase contains **zero** `any` types—every value is properly typed with TypeScript generics and inference. All public APIs are fully typed, and your queries, entities, and results get full TypeScript checking at compile time.

**Q: What design patterns are used?**  
A: MetalORM implements several well-known patterns: Strategy (dialects & functions), Visitor (AST traversal), Builder (query construction), Factory (dialect & executor creation), Unit of Work (change tracking), Identity Map (entity caching), Interceptor (query hooks), and Adapter (pooling). This makes the codebase maintainable and extensible.

---

## Performance & Production 🚀

- **Zero runtime overhead for Level 1** (query builder) - it's just SQL compilation and hydration
- **Efficient batching** for Level 2 lazy relations minimizes database round-trips
- **Identity Map** prevents duplicate entity instances and unnecessary queries
- **Connection pooling** supported via executor factory pattern (see [pooling docs](./docs/pooling.md))
- **Prepared statements** with parameterized queries protect against SQL injection

**Production checklist:**
- ✅ Use connection pooling for better resource management
- ✅ Enable query logging in development for debugging
- ✅ Set up proper error handling and retries
- ✅ Use transactions for multi-statement operations
- ✅ Monitor query performance with interceptors

---

## Community & Support 💬

- 🐛 **Issues:** [GitHub Issues](https://github.com/celsowm/metal-orm/issues)
- 💡 **Discussions:** [GitHub Discussions](https://github.com/celsowm/metal-orm/discussions)
- 📖 **Documentation:** [Full docs](./docs/index.md)
- 🗺️ **Roadmap:** [See what's planned](./ROADMAP.md)
- 📦 **Changelog:** [View releases](https://github.com/celsowm/metal-orm/releases)

---

<a id="contributing"></a>
## Contributing 🤝

Issues and PRs are welcome! If you're interested in pushing the runtime/ORM side further (soft deletes, multi-tenant filters, outbox patterns, etc.), contributions are especially appreciated.

See the contributing guide for details.

---

<a id="license"></a>
## License 📄

MetalORM is MIT licensed.
