# Query Builder Integration

The query builder provides extensive support for relations through joins and includes. Below are examples showing both the TypeScript query builder code and the generated ANSI SQL:

## Joining Relations

```typescript
import { orm } from './orm';

const users = await orm
  .select(User)
  .join('posts', 'LEFT')
  .where({ name: 'John' })
  .execute();
```

## Including Relations

### Basic Include (HasMany Relation):

```typescript
const users = await orm
  .select(User)
  .include('posts', {
    columns: ['id', 'title', 'published']
  })
  .where({ id: 1 })
  .limit(10)
  .execute();
```

**Generated SQL:**
```sql
WITH "__metal_pagination_base" AS (
  SELECT "users"."id" AS "id", 
         "users"."name" AS "name", 
         "users"."email" AS "email", 
         "posts"."id" AS "posts__id", 
         "posts"."title" AS "posts__title", 
         "posts"."published" AS "posts__published" 
  FROM "users" 
  LEFT JOIN "posts" ON "posts"."user_id" = "users"."id" 
  WHERE "users"."id" = ?
), 
"__metal_pagination_page" AS (
  SELECT DISTINCT "__metal_pagination_base"."id" AS "id" 
  FROM "__metal_pagination_base" 
  LIMIT 10
)
SELECT "__metal_pagination_base"."id" AS "id", 
       "__metal_pagination_base"."name" AS "name", 
       "__metal_pagination_base"."email" AS "email", 
       "__metal_pagination_base"."posts__id" AS "posts__id", 
       "__metal_pagination_base"."posts__title" AS "posts__title", 
       "__metal_pagination_base"."posts__published" AS "posts__published" 
FROM "__metal_pagination_base" 
INNER JOIN "__metal_pagination_page" ON "__metal_pagination_base"."id" = "__metal_pagination_page"."id";
```

### BelongsTo Relation Include:

```typescript
const posts = await orm
  .select(Post)
  .include('author', {
    columns: ['id', 'name', 'email']
  })
  .where({ id: 1 })
  .execute();
```

**Generated SQL:**
```sql
SELECT "posts"."id" AS "id", 
       "posts"."title" AS "title", 
       "posts"."content" AS "content", 
       "users"."id" AS "author__id", 
       "users"."name" AS "author__name", 
       "users"."email" AS "author__email" 
FROM "posts" 
LEFT JOIN "users" ON "users"."id" = "posts"."user_id" 
WHERE "posts"."id" = ?;
```

### HasOne Relation Include:

```typescript
const users = await orm
  .select(User)
  .include('profile', {
    columns: ['id', 'bio', 'avatar_url']
  })
  .where({ id: 1 })
  .execute();
```

**Generated SQL:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email", 
       "profiles"."id" AS "profile__id", 
       "profiles"."bio" AS "profile__bio", 
       "profiles"."avatar_url" AS "profile__avatar_url" 
FROM "users" 
LEFT JOIN "profiles" ON "profiles"."user_id" = "users"."id" 
WHERE "users"."id" = ?;
```

### Multiple Relations Include:

```typescript
const users = await orm
  .select(User)
  .include('posts', {
    columns: ['id', 'title']
  })
  .include('profile', {
    columns: ['id', 'bio']
  })
  .where({ id: 1 })
  .execute();
```

**Generated SQL:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email", 
       "posts"."id" AS "posts__id", 
       "posts"."title" AS "posts__title", 
       "profiles"."id" AS "profile__id", 
       "profiles"."bio" AS "profile__bio" 
FROM "users" 
LEFT JOIN "posts" ON "posts"."user_id" = "users"."id" 
LEFT JOIN "profiles" ON "profiles"."user_id" = "users"."id" 
WHERE "users"."id" = ?;
```

### BelongsToMany with Complex Pivot Data:

```typescript
const users = await orm
  .select(User)
  .include('roles', {
    columns: ['id', 'name'],
    pivot: {
      columns: ['assigned_at', 'assigned_by'],
      aliasPrefix: 'role_assignment'
    }
  })
  .where({ id: 1 })
  .execute();
```

**Generated SQL:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email", 
       "roles"."id" AS "roles__id", 
       "roles"."name" AS "roles__name", 
       "user_roles"."assigned_at" AS "role_assignment__assigned_at", 
       "user_roles"."assigned_by" AS "role_assignment__assigned_by" 
FROM "users" 
LEFT JOIN "user_roles" ON "user_roles"."user_id" = "users"."id" 
LEFT JOIN "roles" ON "roles"."id" = "user_roles"."role_id" 
WHERE "users"."id" = ?;
```

## Relation Matching

Use relation matching to find entities based on related entity properties:

```typescript
const users = await orm
  .select(User)
  .match('posts', { title: like('%tutorial%') })
  .limit(10)
  .execute();
```

**Generated SQL:**
```sql
SELECT DISTINCT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email" 
FROM "users" 
INNER JOIN "posts" ON "posts"."user_id" = "users"."id" 
AND "posts"."title" LIKE ? 
LIMIT 10;
```

## Self-Referencing Relations

```typescript
const users = await orm
  .select(User)
  .include('managedUsers', {
    columns: ['id', 'name', 'email']
  })
  .where({ id: 1 })
  .execute();
```

**Generated SQL:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email", 
       "users"."id" AS "managedUsers__id", 
       "users"."name" AS "managedUsers__name" 
FROM "users" 
LEFT JOIN "users" ON "users"."manager_id" = "users"."id" 
WHERE "users"."id" = ?;
```

## Advanced Relation Queries

```typescript
// Nested relations (note: deep nesting may use separate queries)
const users = await orm
  .select(User)
  .include('posts', {
    include: {
      comments: true
    }
  })
  .execute();

// Multiple relations (shown above with individual includes)
const users = await orm
  .select(User)
  .include('posts', { columns: ['id', 'title'] })
  .include('profile', { columns: ['id', 'bio'] })
  .include('roles', { columns: ['id', 'name'] })
  .execute();

// Conditional inclusion
const users = await orm
  .select(User)
  .include('posts', {
    filter: { published: true },
    joinKind: 'INNER'
  })
  .execute();