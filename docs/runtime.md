# Runtime & Unit of Work

This page describes MetalORM's optional entity runtime:

- `OrmContext` – the Unit of Work.
- entities – proxies wrapping hydrated rows.
- relation wrappers – lazy, batched collections and references.

## OrmContext

`OrmContext` owns:

- a SQL dialect,
- a DB executor (`executeSql(sql, params)`),
- an identity map (`table + primaryKey → entity`),
- change tracking for entities and relations,
- hooks and (optionally) domain event dispatch.

```ts
const ctx = new OrmContext({
  dialect: new MySqlDialect(),
  db: {
    async executeSql(sql, params) {
      // call your DB driver here
    }
  }
});
```

## Entities

Entities are created when you call `.execute(ctx)` on a SelectQueryBuilder.

They:

- expose table columns as properties (user.id, user.name, …)
- expose relations as wrappers:
  - HasManyCollection<T> (e.g. user.posts)
  - BelongsToReference<T> (e.g. post.author)
  - ManyToManyCollection<T> (e.g. user.roles)
- track changes to fields and collections for the Unit of Work.

```ts
const [user] = await new SelectQueryBuilder(users)
  .select({ id: users.columns.id, name: users.columns.name })
  .includeLazy('posts')
  .execute(ctx);

user.name = 'Updated Name';          // marks entity as Dirty
const posts = await user.posts.load(); // lazy-batched load
```

## Unit of Work

Each entity in an OrmContext has a status:

- New – created in memory and not yet persisted.
- Managed – loaded from the database and unchanged.
- Dirty – modified scalar properties.
- Removed – scheduled for deletion.

Relations track:

- additions (add, attach, syncByIds),
- removals (remove, detach).

`ctx.saveChanges()`:

- runs hooks / interceptors,
- flushes entity changes as INSERT / UPDATE / DELETE,
- flushes relation changes (FK / pivot),
- dispatches domain events (optional),
- resets tracking.

```ts
user.posts.add({ title: 'From entities' });
user.posts.remove(posts[0]);

await ctx.saveChanges();
```

## Hooks & Domain Events

Each TableDef can define hooks:

```ts
const users = defineTable('users', { /* ... */ }, undefined, {
  hooks: {
    beforeInsert(ctx, user) {
      user.createdAt = new Date();
    },
    afterUpdate(ctx, user) {
      // log audit event
    },
  },
});
```

Entities may accumulate domain events:

```ts
addDomainEvent(user, new UserRegisteredEvent(user.id));
```

After flushing, the context dispatches these events to registered handlers or writes them to an outbox table.
