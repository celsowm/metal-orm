# Runtime & Unit of Work

- This page describes MetalORM's optional entity runtime:

- `OrmSession` - the Unit of Work runtime (backed by an `Orm`).
- entities - proxies wrapping hydrated rows.
- relation wrappers - lazy, batched collections and references.

## OrmSession

`OrmSession` coordinates:

- a SQL dialect,
- a DB executor (`executeSql(sql, params)`),
- an identity map (`table + primaryKey -> entity`),
- a UnitOfWork (tracking + INSERT/UPDATE/DELETE flush),
- a RelationChangeProcessor (FK / pivot updates),
- a DomainEventBus (optional handlers),
- session-bound lifecycle hooks and flush interceptors.

```ts
import mysql from 'mysql2/promise';
import {
  Orm,
  OrmSession,
  MySqlDialect,
  createMysqlExecutor,
} from 'metal-orm';

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
```

### Caching

`OrmSession` integrates with MetalORM's caching system. When an `Orm` is configured with a cache provider, sessions automatically use it for cached queries:

```ts
const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: myExecutorFactory,
  cache: {
    provider: new MemoryCacheAdapter(),
    defaultTtl: '1h'
  }
});

const session = orm.createSession();

// This query will be cached
const users = await selectFromEntity(User)
  .cache('active_users', '30m')
  .execute(session);

// Later, invalidate the cache
await session.invalidateCacheTags(['users']);
```

See the [Caching documentation](./caching.md) for complete details on cache providers, TTL formats, invalidation strategies, and multi-tenancy support.

### Query logging

Pass `queryLogger` when you construct the [`OrmSession`](docs/runtime.md#ormsession) so every SQL call is logged before it hits your driver.

```ts
const session = new OrmSession({
  orm,
  executor,
  queryLogger(entry) {
    console.log('SQL:', entry.sql);
    if (entry.params?.length) {
      console.log('Params:', entry.params);
    }
  }
});
```

### Query interceptors (SQL-level)

`Orm` exposes a query interceptor pipeline (`orm.interceptors`) that wraps SQL execution for query builders running through an `OrmSession` (e.g. `selectFrom(...).execute(session)` and `update(...).execute(session)`).

This is intentionally SQL-level (it sees `{ sql, params }`), so it's best suited for logging, timing, tracing, and other cross-cutting concerns:

```ts
const orm = new Orm({ dialect, executorFactory });

orm.interceptors.use(async (ctx, next) => {
  const started = Date.now();
  try {
    return await next();
  } finally {
    const ms = Date.now() - started;
    console.log(`[sql] ${ms}ms`, ctx.sql);
  }
});
```

Note: this is separate from `OrmSession`'s `beforeFlush` / `afterFlush` interceptors, which run around `session.commit()`.

## Entities

Entities are created when you call `.execute(session)` on a query builder.

They:

- expose table columns as properties (user.id, user.name, .)
- expose relations as wrappers:
  - HasManyCollection<T> (e.g. user.posts)
  - BelongsToReference<T> (e.g. post.author)
  - ManyToManyCollection<T> (e.g. user.roles)
- track changes to fields and collections for the Unit of Work.
- are safe to log/serialize: relation wrappers hide internal references and implement `toJSON`, so `JSON.stringify(entity)` won't walk into circular graphs.

```ts
import { selectFrom } from 'metal-orm';

const [user] = await selectFrom(users)
  .select({ id: users.columns.id, name: users.columns.name })
  .includeLazy('posts')
  .execute(session);

user.name = 'Updated Name';          // marks entity as Dirty
const posts = await user.posts.load(); // lazy-batched load
```

### Manual entity creation

`createEntityFromRow(entityContext, table, data, lazyRelations?)` turns a plain object into a tracked entity:

- If the primary key is present and matches an existing tracked entity, it returns that instance.
- Otherwise it creates a new proxy, tracks it as New or Managed, and wires relation wrappers.
- Accepts an optional generic to bind the concrete entity type if you want to avoid casts: `createEntityFromRow<typeof table, MyEntity>(ctx, table, data)`.

## Unit of Work

Each entity tracked by an OrmSession has a status:

- New - created in memory and not yet persisted.
- Managed - loaded from the database and unchanged.
- Dirty - modified scalar properties.
- Removed - scheduled for deletion.

Relations track:

- additions (add, attach, syncByIds),
- removals (remove, detach).

`session.commit()`:

- runs session interceptors and entity lifecycle hooks,
- flushes entity changes as INSERT / UPDATE / DELETE,
- flushes relation changes (FK / pivot),
- dispatches domain events (optional).

Note: `session.flush()` only runs the Unit of Work INSERT/UPDATE/DELETE pass. Table lifecycle hooks still run because they belong to the Unit of Work; `beforeFlush`/`afterFlush` interceptors, relation changes, and domain events are skipped. Prefer `commit()` or `transaction()` for application-level persistence.

```ts
user.posts.add({ title: 'From entities' });
user.posts.remove(posts[0]);

await session.commit();
```

## Hooks & Domain Events

Lifecycle hooks are runtime policy and belong to an `OrmSession`, not to `TableDef` schema metadata. Register them for a table:

```ts
session.registerTableHooks(users, {
  beforeInsert(ctx, user) {
    user.createdAt = new Date();
  },
  afterUpdate(ctx, user) {
    // log audit event
  },
});
```

For decorator entities, the entity constructor can be used directly:

```ts
session.registerTableHooks(User, {
  beforeUpdate(ctx, user) {
    // user is typed as User
  },
});
```

The registry is session-scoped. The same `TableDef` can therefore be shared by two sessions with different lifecycle policies without mutating schema metadata or leaking behavior between requests.

Table hooks execute inside the Unit of Work at the operation boundary:

- `beforeInsert` before extracting the INSERT payload;
- `afterInsert` after generated values, snapshot and identity-map registration;
- `beforeUpdate` only when there is a real dirty diff;
- `afterUpdate` after the refreshed snapshot;
- `beforeDelete` before DELETE;
- `afterDelete` after the entity has been detached from tracking.

Entities may accumulate domain events:

```ts
addDomainEvent(user, new UserRegisteredEvent(user.id));
```

Domain events are dispatched after a successful commit; nested transaction savepoints are not dispatch boundaries.
