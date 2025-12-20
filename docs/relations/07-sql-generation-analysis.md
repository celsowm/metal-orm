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

### Advanced Relation Queries

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