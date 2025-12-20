# Limitations and Issues Found in Relations SQL Generation

During comprehensive testing with real SQLite database execution, several limitations and issues were discovered in Metal ORM's relation SQL generation:

## 1. Self-Referencing Relations Bug ⚠️

**Issue**: Self-referencing relations generate SQL with ambiguous column names
**Impact**: Causes SQL errors in strict databases (SQLite, PostgreSQL, etc.)

**Query Builder Code That Produces This**:
```typescript
// This query builder code generates the problematic SQL below
const users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    manager_id: col.int()
});

users.relations = {
    managedUsers: hasMany(users, 'manager_id')  // Self-reference
};

const query = new SelectQueryBuilder(users)
    .include('managedUsers', {
        columns: ['id', 'name']
    })
    .where(eq(users.columns.id, 1));
```

**Problematic SQL Generated**:
```sql
SELECT "users"."id" AS "id", 
       "users"."name" AS "name", 
       "users"."id" AS "managedUsers__id", 
       "users"."name" AS "managedUsers__name"
FROM "users" 
LEFT JOIN "users" ON "users"."manager_id" = "users"."id"
WHERE "users"."id" = ?;
```

**Error**: `SQLITE_ERROR: ambiguous column name: users.id`

**Root Cause**: When joining the same table, the ORM doesn't generate unique table aliases, leading to duplicate column names.

**Workaround**: Use separate queries for self-referencing relations until this is fixed.

## 2. Deep Nested Relations Performance Design 🔄

**Issue**: Relations nested beyond one level don't generate complex multi-JOIN SQL
**Impact**: May require multiple queries instead of single complex query

**Behavior**:
```typescript
.include('posts', {
  include: {
    comments: true  // This level loaded separately
  }
})
```

**SQL Generated**: Only includes 'posts' in main query, 'comments' loaded via separate lazy-load query

**Design Choice**: This is actually intentional for performance - prevents exponential JOIN complexity

## 3. JOIN Operations Not Available 🚫

**Issue**: Direct JOIN operations not supported in query builder
**Impact**: Cannot perform manual JOINs outside of relation system

**Missing Feature**:
```typescript
// This doesn't work
.select(User)
.join('posts', 'LEFT')
.join('comments', 'LEFT')
```

**Alternative**: Must use relation-based `.include()` operations

## 4. Complex Relation Matching Limitations 🔍

**Issue**: Complex `.match()` operations with multiple conditions had syntax issues
**Impact**: Advanced filtering on related entities may not work as expected

**Attempted**:
```typescript
.match('roles', {
  name: like('%admin%')
})
```

**Error**: Column reference issues in match expressions

## 5. Column Selection in Nested Relations 🎯

**Issue**: When using nested includes, column selection doesn't propagate to nested levels
**Impact**: May load more columns than necessary in nested relations

**Example**:
```typescript
.include('posts', {
  columns: ['id', 'title'],  // Only applies to posts
  include: {
    comments: true  // Loads ALL comment columns
  }
})
```

## 6. Batch Loading Assumptions 📦

**Issue**: Documentation suggests batch loading works automatically, but may require specific patterns
**Impact**: Developers might write inefficient queries expecting automatic batching

**Expected**:
```typescript
const users = await query.execute();
// All users' posts loaded in single batch
for (const user of users) {
  await user.posts.load(); // Should use batch
}
```

**Reality**: May generate individual queries depending on relation configuration

## 7. Pagination with Relations Complexity 📄

**Issue**: CTE-based pagination with relations can generate complex SQL
**Impact**: Performance may degrade with large result sets and multiple relations

**Pattern Found**:
```sql
WITH "__metal_pagination_base" AS (
  SELECT ...complex multi-table joins...
),
"__metal_pagination_page" AS (
  SELECT DISTINCT ...pagination logic...
)
SELECT ...final results...
```

## Summary of Impact

| Limitation | Severity | Workaround |
|------------|----------|------------|
| Self-referencing ambiguous columns | **High** | Use separate queries |
| Deep nested relation loading | **Medium** | Accept multiple queries |
| No direct JOIN operations | **Medium** | Use include() instead |
| Complex match operations | **Low** | Use where() on main query |
| Column selection propagation | **Low** | Explicit column selection |
| Batch loading assumptions | **Low** | Test with large datasets |
| Pagination complexity | **Low** | Monitor query performance |

## Recommendations for Users

1. **Avoid self-referencing relations** in complex queries until bug is fixed
2. **Accept multiple queries** for deep nested relations as designed
3. **Use include() instead of direct JOINs** for relation queries
4. **Test with real data volumes** to validate performance assumptions
5. **Enable query logging** to monitor actual SQL generation
6. **Consider query complexity** when designing relation structures

These limitations are primarily architectural choices or bugs that developers should be aware of when designing their data access patterns.