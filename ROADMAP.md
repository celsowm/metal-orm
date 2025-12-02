# Metal ORM Roadmap

## Current ORM Capabilities

The current implementation supports:

- Basic SELECT with projections and aliases
- INNER/LEFT JOINs with manual conditions
- Smart relationship joins via `joinRelation()`
- Eager loading with `include()` for 1:1 and 1:N relationships
- Basic WHERE clauses with operators (eq, gt, like, in, null checks)
- GROUP BY, ORDER BY, LIMIT, OFFSET
- Aggregation functions (COUNT, SUM, AVG)
- JSON path extraction (dialect-specific)
- Hydration of nested objects from flat SQL results
- EXISTS and NOT EXISTS subqueries
- Scalar correlated subqueries in SELECT and WHERE
- CASE expressions (simple and searched)
- HAVING clause for post-aggregation filtering

## Identified Absences

### 1. CTE (Common Table Expressions) ✅

**Completed:** Full CTE support has been implemented

- Features: Simple CTEs, Recursive CTEs, Multiple CTEs, CTE with column aliases
- **Implementation:** CTE AST node and dialect compilation for SQLite, MySQL, and MSSQL
- Recursive CTEs properly handle the `WITH RECURSIVE` keyword (SQLite/MySQL only, MSSQL uses plain `WITH`)
- Mixed recursive and non-recursive CTEs are supported

### 2. Window Functions ✅

**Completed:** Comprehensive window function support has been implemented

- Features: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, `NTILE()`, `FIRST_VALUE()`, `LAST_VALUE()`
- **Implementation:** Window function AST nodes with `PARTITION BY` and `ORDER BY` support
- All three dialects (SQLite, MySQL, MSSQL) support window functions

### 3. RIGHT JOIN Support

**Missing:** Only INNER, LEFT, and CROSS joins are defined

- **Required Addition:** RIGHT JOIN support in join.ts and dialect compilation

### 4. Complex Aggregation Functions

**Missing:** Limited aggregation functions

- Queries: `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** MIN, MAX, AVG functions, and GROUP_CONCAT

### 5. Parameterized Queries

**Missing:** No parameter binding support

- Queries: `1-1-parameterized-user-by-twitter`
- **Required Addition:** Parameter placeholder support and binding mechanism

### 6. Advanced JSON Operations

**Missing:** Limited JSON functionality

- Queries: `1-1-profile-json-as-subquery-column`, `5-mega-user-engagement-analytics`
- **Required Addition:** JSON_OBJECT, JSON_ARRAYAGG functions

### 7. Recursive CTEs ✅

**Completed:** See Section 1 (CTE) above

- Recursive CTEs are fully supported as part of the CTE implementation

### 8. Complex Ordering

**Missing:** Limited ORDER BY expressions

- Queries: `1-1-order-by-subquery-profile-field`, `5-mega-user-engagement-analytics`
- **Required Addition:** ORDER BY with expressions and NULLS FIRST/LAST

### 9. DISTINCT ON (PostgreSQL-style)

**Missing:** No DISTINCT ON support

- **Required Addition:** Dialect-specific DISTINCT ON compilation

### 10. Subquery Aliasing

**Missing:** No support for subqueries as derived tables

- **Required Addition:** Derived table AST node

### 11. Advanced EXISTS Patterns

**Missing:** EXISTS with complex correlated subqueries

- Queries: `1-1-boolean-flag-from-subquery-on-profile`
- **Required Addition:** Complex correlation support

## Priority Implementation Order

### Completed ✅

- ~~CTE support~~ (Completed)
- ~~Window functions~~ (Completed)
- ~~Recursive CTEs~~ (Completed)

### High Priority:

- Parameterized queries
- RIGHT JOIN
- Complex aggregation functions (MIN, MAX, GROUP_CONCAT)

### Medium Priority:

- Advanced JSON operations
- Complex ordering (expressions, NULLS FIRST/LAST)

### Lower Priority:

- Subquery Aliasing (Derived tables)
- Advanced EXISTS Patterns

## Implementation Notes

The current ORM is well-architected with a clear AST structure and dialect abstraction, making it relatively straightforward to add these missing features by extending the existing patterns.
