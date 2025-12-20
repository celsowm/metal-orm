# Lazy Loading

Metal ORM implements efficient lazy loading with batch loading capabilities:

## Automatic Lazy Loading

Relations are automatically lazy-loaded when accessed:

```typescript
const user = await orm.findOne(User, 1);
// Posts are not loaded yet
const posts = await user.posts.load(); // Now they're loaded
```

## Batch Loading

Multiple entities' relations are loaded in efficient batches:

```typescript
const users = await orm.select(User).execute();
// All users' posts will be loaded in a single query when accessed
for (const user of users) {
  const posts = await user.posts.load(); // Uses batch loading
}
```

## SQL Patterns for Lazy Loading

When relations are lazy-loaded, Metal ORM generates targeted queries:

**HasMany Lazy Load:**
```sql
SELECT "posts"."id" AS "id", 
       "posts"."title" AS "title", 
       "posts"."user_id" AS "user_id" 
FROM "posts" 
WHERE "posts"."user_id" = ?;
```

**BelongsTo Lazy Load:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email" 
FROM "users" 
WHERE "users"."id" = ?;
```

**BelongsToMany Lazy Load:**
```sql
SELECT "roles"."id" AS "id", 
       "roles"."name" AS "name", 
       "user_roles"."assigned_at" AS "assigned_at" 
FROM "roles" 
INNER JOIN "user_roles" ON "user_roles"."role_id" = "roles"."id" 
WHERE "user_roles"."user_id" = ?;
```

## Hydration Cache

Relations are cached within the entity context for the current operation:

```typescript
const user = await orm.findOne(User, 1);
await user.posts.load(); // First load executes query
const samePosts = await user.posts.load(); // Uses cache, no query