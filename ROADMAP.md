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

### 1. CTE (Common Table Expressions)

**Missing:** No CTE support

- Queries: `1-1-cte-plus-subquery-on-cte`, `1-1-window-function-in-cte-and-subquery`
- **Required Addition:** CTE AST node and dialect compilation

### 2. Window Functions

**Missing:** No window function support

- Queries: `1-1-window-function-in-cte-and-subquery`, `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** Window function AST node and compilation

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

### 7. Recursive CTEs

**Missing:** No recursive CTE support

- Queries: `5-mega-user-engagement-analytics`
- **Required Addition:** Recursive CTE compilation

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

### High Priority:

- CTE support
- Window functions
- RIGHT JOIN
- Parameterized queries

### Medium Priority:

- Recursive CTEs
- Advanced JSON operations
- Complex aggregation functions
- DISTINCT ON

### Lower Priority:

- Subquery Aliasing
- Advanced EXISTS Patterns

## Implementation Notes

The current ORM is well-architected with a clear AST structure and dialect abstraction, making it relatively straightforward to add these missing features by extending the existing patterns.
