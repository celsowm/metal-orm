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

## Identified Absences

### 1. EXISTS Subqueries

**Missing:** No support for EXISTS expressions

- Queries: `1-1-exists-subquery-on-profile`, `1-1-multi-correlated-subqueries`, `1-1-case-expression-with-subqueries-and-fallback`
- **Required Addition:** `exists()` function in expression.ts and corresponding AST node

### 2. Scalar Correlated Subqueries

**Missing:** No support for scalar subqueries in SELECT or WHERE clauses

- Queries: `1-1-subquery-selecting-profile-fields`, `1-1-multi-correlated-subqueries`, `1-1-profile-json-as-subquery-column`
- **Required Addition:** Subquery AST node and compilation support

### 3. CTE (Common Table Expressions)

**Missing:** No CTE support

- Queries: `1-1-cte-plus-subquery-on-cte`, `1-1-window-function-in-cte-and-subquery`
- **Required Addition:** CTE AST node and dialect compilation

### 4. Window Functions

**Missing:** No window function support

- Queries: `1-1-window-function-in-cte-and-subquery`, `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** Window function AST node and compilation

### 5. CASE Expressions

**Missing:** No CASE expression support

- Queries: `1-1-case-expression-with-subqueries-and-fallback`, `5-mega-user-engagement-analytics`
- **Required Addition:** CASE AST node and compilation

### 6. RIGHT JOIN Support

**Missing:** Only INNER, LEFT, and CROSS joins are defined

- **Required Addition:** RIGHT JOIN support in join.ts and dialect compilation

### 7. HAVING Clause

**Missing:** No HAVING clause support for post-aggregation filtering

- Queries: `3-nn-aggregate-on-join-table`, `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** HAVING support in query AST and compilation

### 8. Complex Aggregation Functions

**Missing:** Limited aggregation functions

- Queries: `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** MIN, MAX, AVG functions, and GROUP_CONCAT

### 9. Parameterized Queries

**Missing:** No parameter binding support

- Queries: `1-1-parameterized-user-by-twitter`
- **Required Addition:** Parameter placeholder support and binding mechanism

### 10. Advanced JSON Operations

**Missing:** Limited JSON functionality

- Queries: `1-1-profile-json-as-subquery-column`, `5-mega-user-engagement-analytics`
- **Required Addition:** JSON_OBJECT, JSON_ARRAYAGG functions

### 11. Recursive CTEs

**Missing:** No recursive CTE support

- Queries: `5-mega-user-engagement-analytics`
- **Required Addition:** Recursive CTE compilation

### 12. Complex Ordering

**Missing:** Limited ORDER BY expressions

- Queries: `1-1-order-by-subquery-profile-field`, `5-mega-user-engagement-analytics`
- **Required Addition:** ORDER BY with expressions and NULLS FIRST/LAST

### 13. DISTINCT ON (PostgreSQL-style)

**Missing:** No DISTINCT ON support

- **Required Addition:** Dialect-specific DISTINCT ON compilation

### 14. Subquery Aliasing

**Missing:** No support for subqueries as derived tables

- **Required Addition:** Derived table AST node

### 15. Advanced EXISTS Patterns

**Missing:** EXISTS with complex correlated subqueries

- Queries: `1-1-boolean-flag-from-subquery-on-profile`
- **Required Addition:** Complex correlation support

## Priority Implementation Order

### High Priority:

- EXISTS expressions
- Scalar correlated subqueries
- HAVING clause
- CASE expressions

### Medium Priority:

- CTE support
- Window functions
- RIGHT JOIN
- Parameterized queries

### Lower Priority:

- Recursive CTEs
- Advanced JSON operations
- Complex aggregation functions
- DISTINCT ON

## Implementation Notes

The current ORM is well-architected with a clear AST structure and dialect abstraction, making it relatively straightforward to add these missing features by extending the existing patterns.
