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

### BelongsToMany with Pivot Data:

```typescript
const users = await orm
  .select(User)
  .include('roles', {
    columns: ['id', 'name'],
    pivot: {
      columns: ['assigned_at'],
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
       "users_roles"."assigned_at" AS "role_assignment__assigned_at" 
FROM "users" 
LEFT JOIN "users_roles" ON "users_roles"."user_id" = "users"."id" 
LEFT JOIN "roles" ON "roles"."id" = "users_roles"."role_id" 
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

## Advanced Relation Queries

```typescript
// Nested relations
const users = await orm
  .select(User)
  .include('posts', {
    include: {
      comments: true
    }
  })
  .execute();

// Multiple relations
const users = await orm
  .select(User)
  .include(['posts', 'profile', 'roles'])
  .execute();

// Conditional inclusion
const users = await orm
  .select(User)
  .include('posts', {
    filter: { published: true },
    joinKind: 'INNER'
  })
  .execute();