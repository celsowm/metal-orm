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
- interceptors / hooks around flush.

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

- runs hooks / interceptors,
- flushes entity changes as INSERT / UPDATE / DELETE,
- flushes relation changes (FK / pivot),
- dispatches domain events (optional),
- resets tracking.

```ts
user.posts.add({ title: 'From entities' });
user.posts.remove(posts[0]);

await session.commit();
```

## Hooks & Domain Events

Each TableDef can define hooks:

```ts
const users = defineTable('users', { /* ... */ }, undefined, {
  beforeInsert(ctx, user) {
    user.createdAt = new Date();
  },
  afterUpdate(ctx, user) {
    // log audit event
  },
});
```

Entities may accumulate domain events:

```ts
addDomainEvent(user, new UserRegisteredEvent(user.id));
```

After flushing, the context dispatches these events to registered handlers or writes them to an outbox table.
