# Appendix: Complete SQL Examples

This appendix provides a comprehensive reference of generated SQL for various relation query patterns:

## 1. HasMany Relation with Pagination

**Query Builder:**
```typescript
orm.select(User)
  .include('posts', { columns: ['id', 'title', 'published'] })
  .where({ id: 1 })
  .limit(10)
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

## 2. BelongsTo Relation

**Query Builder:**
```typescript
orm.select(Post)
  .include('author', { columns: ['id', 'name', 'email'] })
  .where({ id: 1 })
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

## 3. BelongsToMany with Pivot Data

**Query Builder:**
```typescript
orm.select(User)
  .include('roles', {
    columns: ['id', 'name'],
    pivot: {
      columns: ['assigned_at'],
      aliasPrefix: 'role_assignment'
    }
  })
  .where({ id: 1 })
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

## 4. Relation Matching

**Query Builder:**
```typescript
orm.select(User)
  .match('posts', { title: like('%tutorial%') })
  .limit(10)
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

## 5. HasOne Relation

**Query Builder:**
```typescript
orm.select(User)
  .include('profile', { 
    columns: ['id', 'bio', 'avatar_url'] 
  })
  .where({ id: 1 })
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

## 6. Multiple Relations

**Query Builder:**
```typescript
orm.select(User)
  .include('posts', { 
    columns: ['id', 'title'] 
  })
  .include('profile', { 
    columns: ['id', 'bio'] 
  })
  .where({ id: 1 })
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

## 7. Self-Referencing Relations

**Query Builder:**
```typescript
orm.select(User)
  .include('managedUsers', { 
    columns: ['id', 'name'] 
  })
  .where({ id: 1 })
```

**Generated SQL:**
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."email" AS "email", 
       "users"."manager_id" AS "manager_id", 
       "managedUsers"."id" AS "managedUsers__id", 
       "managedUsers"."name" AS "managedUsers__name", 
       "managedUsers"."email" AS "managedUsers__email", 
       "managedUsers"."manager_id" AS "managedUsers__manager_id" 
FROM "users" 
LEFT JOIN "users" AS "managedUsers" ON "managedUsers"."manager_id" = "users"."id" 
WHERE "users"."id" = ?;
```

> **Note:** MetalORM automatically generates unique table aliases when joining the same table multiple times. This prevents SQL errors (such as SQL Server's "same exposed names" error) when using self-referencing relations or multiple relations pointing to the same table.

## 8. Complex Nested Relations

For complex queries with multiple levels of nesting, Metal ORM generates multiple JOINs and uses appropriate aliasing to avoid column name conflicts. The ORM automatically handles:

- **Alias Generation**: Creates unique aliases for each relation level
- **Join Chain Optimization**: Minimizes the number of joins while maintaining data integrity
- **Column Prefixing**: Uses double underscore notation for nested relations (`posts__comments__author__name`)

**Note**: Nested relations beyond the first level are typically loaded via separate queries for performance optimization, rather than generating extremely complex SQL with many JOINs.

## Performance Considerations

**Generated SQL Patterns:**

1. **CTEs for Pagination**: Uses Common Table Expressions to handle limit/offset efficiently with included relations
2. **LEFT JOINs**: Default for includes to preserve root entities even without related data
3. **DISTINCT for Matching**: Prevents duplicate root entities when matching on has-many relations
4. **Double JOINs for Many-to-Many**: Proper pivot table handling for BelongsToMany relations

**Optimization Tips:**

- Use specific `columns` to reduce data transfer
- Apply `filter` at the database level when possible
- Use `joinKind: 'INNER'` for mandatory relations
- Monitor generated SQL with `.log()` method
- Consider pagination early to avoid large result sets

This comprehensive guide covers all aspects of relations in Metal ORM, from basic concepts to advanced usage patterns. The relations system provides a powerful and type-safe way to work with related entities while maintaining excellent performance through lazy loading and batch loading capabilities.