# Metal ORM Roadmap

## Current ORM Capabilities

The current implementation supports:

- Basic SELECT with projections and aliases
- INNER/LEFT/RIGHT JOINs with manual conditions
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
- Parameterized queries with parameter binding

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

### 3. RIGHT JOIN Support ✅

**Completed:** Full RIGHT JOIN support has been implemented

- **Implementation:** RIGHT JOIN support in query builder, AST, and dialect compilation
- Query builder method: `rightJoin(table, condition)`
- AST node support for RIGHT join kind
- Dialect compilation handles RIGHT JOIN syntax

### 4. Complex Aggregation Functions

**Partially Completed:** Basic aggregation functions implemented

- **Implemented:** COUNT, SUM, AVG functions
- **Missing:** MIN, MAX functions, and GROUP_CONCAT
- Queries: `5-top-platform-contributor-per-project`, `5-mega-user-engagement-analytics`
- **Required Addition:** MIN, MAX functions, and GROUP_CONCAT

### 5. Parameterized Queries ✅

**Completed:** Full parameter binding support has been implemented

- **Implementation:** Parameter management in compiler context
- Parameter placeholders with dialect-specific formatting
- Parameter array tracking and binding
- **Usage:** Automatic parameter handling in query compilation
- Queries: `1-1-parameterized-user-by-twitter`

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

**Work in progress:** Relation-based correlated EXISTS checks (e.g., `whereHas()` and manually correlated subqueries covered by `tests/complex-exists.test.ts`) already compile valid SQL, but truly complex correlations (arbitrary expressions or derived tables) still need full support.

- Queries: `1-1-boolean-flag-from-subquery-on-profile`
- **Required Addition:** Broader complex correlation support

## Priority Implementation Order

### Completed ✅

- ~~CTE support~~ (Completed)
- ~~Window functions~~ (Completed)
- ~~Recursive CTEs~~ (Completed)
- ~~RIGHT JOIN support~~ (Completed)
- ~~Parameterized queries~~ (Completed)

### High Priority:

- Complex aggregation functions (MIN, MAX, GROUP_CONCAT)

### Medium Priority:

- Advanced JSON operations
- Complex ordering (expressions, NULLS FIRST/LAST)

### Lower Priority:

- Subquery Aliasing (Derived tables)
- Advanced EXISTS Patterns

## New: Schema Generation, Introspection, and Synchronization

- **Implemented:** Multi-dialect DDL generation (Postgres, MySQL/MariaDB, SQLite, SQL Server)
  - Rich column metadata: default/defaultRaw, notNull, unique, checks, FK references, auto-increment/identity
  - Table metadata: composite PKs, indexes (unique/filtered where supported), checks, schema hints, engine/charset/collation
- **Implemented:** Dialect-aware schema introspection into normalized `DatabaseSchema` (Postgres, MySQL/MariaDB, SQLite, SQL Server)
- **Implemented:** Diff + sync preview
  - `diffSchema` produces ordered changes (create table, add/drop column, add/drop index, drop table)
  - `synchronizeSchema` applies the plan with `allowDestructive`/`dryRun` safeguards
  - SQLite drop column warns (rebuild needed)
- **Planned next:**
  - Smarter alter/rename detection and column-level diffs (type/null/default/identity changes)
  - SQLite table rebuild helper for destructive ops
  - CLI commands: `schema:diff`, `schema:sync`, `schema:generate`
  - Migration file emission (up/down SQL) and safety levels by environment
  - Dialect-specific nuances (partial indexes validation, deferrable FKs, clustered index hints)

## Implementation Notes

The current ORM is well-architected with a clear AST structure and dialect abstraction, making it relatively straightforward to add these missing features by extending the existing patterns.
