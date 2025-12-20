# SQL Generation Analysis

Understanding how Metal ORM translates query builder operations into SQL helps with performance optimization and debugging:

## Key SQL Patterns

1. **CTE for Pagination**: Metal ORM uses Common Table Expressions (CTEs) for efficient pagination with included relations
2. **Alias Prefixing**: Related entity columns are prefixed with the relation name (e.g., `posts__title`)
3. **Pivot Table Handling**: Many-to-many relations generate double LEFT JOINs through the pivot table
4. **DISTINCT for Matching**: Relation matching uses DISTINCT to avoid duplicate root entities

## Query Performance Tips

- Use `columns` option to limit selected fields and reduce data transfer
- Leverage `filter` option to pre-filter related entities in the database
- Consider using `joinKind: 'INNER'` for mandatory relations to improve performance
- Monitor generated SQL using the `.log()` method to identify optimization opportunities

## Missing SQL Patterns

Some advanced relation patterns generate SQL differently than expected:

### Self-Referencing Relations
Self-referencing relations (like user hierarchies) generate JOINs to the same table:

```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."id" AS "managedUsers__id" 
FROM "users" 
LEFT JOIN "users" ON "users"."manager_id" = "users"."id" 
WHERE "users"."id" = ?;
```

### Deep Nested Relations
Relations nested beyond one level typically use separate queries for performance rather than generating complex multi-JOIN SQL. When you include nested relations like:

```typescript
.include('posts', {
  include: {
    comments: true
  }
})
```

Only the first level ('posts') is included in the main SQL query. The nested relations ('comments') are loaded via separate queries when accessed, which is more efficient than generating complex SQL with multiple JOINs.

### JOIN Operations
Direct JOIN operations are not currently supported in the query builder - relations are handled through include operations.

## Complete SQL Examples by Relation Type

| Relation Type | SQL Pattern | Key Characteristics |
|---------------|-------------|-------------------|
| **HasMany** | LEFT JOIN with collection | Returns multiple rows per parent |
| **HasOne** | LEFT JOIN with single row | Returns at most one row per parent |
| **BelongsTo** | LEFT JOIN with foreign key | Links child to parent entity |
| **BelongsToMany** | Double LEFT JOIN through pivot | Handles many-to-many with pivot data |
| **Self-Referencing** | JOIN to same table | Uses table aliases for hierarchy |

## Advanced Relation Queries

```typescript
// Multiple relations (use individual includes)
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