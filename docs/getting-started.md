# Getting Started

This guide walks you through:

1. Using MetalORM as a **simple query builder**.
2. Hydrating relations into nested objects.
3. Taking a first look at the **OrmSession** runtime.

## 1. Installation

```bash
npm install metal-orm
# or
yarn add metal-orm
# or
pnpm add metal-orm
```

## 2. Your first query (builder only)

```typescript
import { defineTable, col, selectFrom, eq, MySqlDialect } from 'metal-orm';

const todos = defineTable('todos', {
  id: col.primaryKey(col.int()),
  title: col.notNull(col.varchar(255)),
  done: col.default(col.boolean(), false),
});

const query = selectFrom(todos)
  .select({
    id: todos.columns.id,
    title: todos.columns.title,
  })
  .where(eq(todos.columns.done, false));

const dialect = new MySqlDialect();
const { sql, params } = query.compile(dialect);

// Execute `sql` + `params` with your DB driver.
```

## 3. Adding relations & hydration

```typescript
import {
  defineTable,
  col,
  hasMany,
  selectFrom,
  eq,
  count,
  rowNumber,
  hydrateRows,
} from 'metal-orm';

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.notNull(col.varchar(255)),
  userId: col.notNull(col.int()),
  createdAt: col.defaultRaw(col.timestamp(), 'CURRENT_TIMESTAMP'),
});

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
  email: col.unique(col.varchar(255)),
}, {
  posts: hasMany(posts, 'userId'),
});

> For one-to-one relationships, swap in `hasOne` and mark the child-side foreign key as unique so only one row can point back at each parent (see [Schema Definition](schema-definition.md#relations) for the full example).

// Build a query with relation & window function
const builder = selectFrom(users)
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
  .includePick('posts', ['id', 'title', 'createdAt']); // eager relation for hydration

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

## 4. A taste of the runtime (optional)

When you're ready to let MetalORM manage entities and relations, you build an `Orm` instance and work through an [`OrmSession`](docs/runtime.md#ormsession) runtime.

```typescript
import mysql from 'mysql2/promise';
import {
  Orm,
  OrmSession,
  MySqlDialect,
  selectFrom,
  eq,
  createMysqlExecutor,
} from 'metal-orm';

// 1) Wrap your driver into a DbExecutor
const connection = await mysql.createConnection({ /* connection config */ });
const executor = createMysqlExecutor(connection);

const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
  },
});

const session = new OrmSession({ orm, executor });

// 2) Load entities with lazy relations
const [user] = await selectFrom(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    email: users.columns.email,
  })
  .includeLazy('posts')  // HasMany as a lazy collection
  .where(eq(users.columns.id, 1))
  .execute(session);

// user is an EntityInstance<typeof users>
// scalar props are normal:
user.name = 'Updated Name';  // marks entity as Dirty

// relations are live collections:
const postsCollection = await user.posts.load(); // batched lazy load
const newPost = user.posts.add({ title: 'Hello from ORM mode' });

// 3) Persist the entire graph
await session.commit();
// INSERT/UPDATE/DELETE + pivot updates happen in a single Unit of Work.

```

If you have a `BelongsToMany` relation, the same lazy collection API works (`await user.roles.syncByIds([...])`).

See [Runtime & Unit of Work](./runtime.md) for full details on entities, the Unit of Work, and how to integrate `OrmSession` into a request lifecycle.
