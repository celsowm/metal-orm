# Documentation Updates Summary

This document summarizes the major updates made to the MetalORM documentation to reflect all new features.

## New Documentation Files

### `dml-operations.md`
- **New File**: Comprehensive documentation for INSERT, UPDATE, and DELETE operations
- **Features Covered**:
  - `InsertQueryBuilder` with single and multi-row inserts
  - `UpdateQueryBuilder` with conditional updates
  - `DeleteQueryBuilder` with safety best practices
  - RETURNING clause support across all DML operations
  - Multi-dialect support for all DML operations

## Updated Documentation Files

### `index.md`
- **Updates**:
  - Added DML Operations to the table of contents
  - Updated philosophy to include PostgreSQL in multi-dialect support
  - Added "Comprehensive Relation Support" to features list
  - Added "DML Operations" to features list

### `schema-definition.md`
- **Updates**:
  - Added `belongsTo` relation type documentation
  - Added comprehensive `belongsToMany` relation documentation with pivot table examples
  - Updated relation section with all three relation types

### `advanced-features.md`
- **Updates**:
  - Enhanced window functions section with convenience helpers
  - Added examples for `rowNumber()`, `rank()`, `lag()`, `lead()` functions
  - Improved CTE examples with better explanations

### `multi-dialect-support.md`
- **Updates**:
  - Added PostgreSQL dialect to supported dialects
  - Added dialect-specific features section
  - Added examples showing SQL Server TOP vs LIMIT differences

### `api-reference.md`
- **Updates**:
  - Added `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` to core classes
  - Added `PostgresDialect` to dialect compilers
  - Added `belongsToMany()` to relation definitions
  - Added `notLike()`, `notBetween()`, `firstValue()`, `lastValue()`, `ntile()` to utility functions
  - Added `isNull()`, `isNotNull()` to null checking functions

### `hydration.md`
- **Updates**:
  - Enhanced pivot column hydration documentation
  - Added comprehensive examples of `_pivot` key usage
  - Added advanced hydration options with custom aliases

### `query-builder.md`
- **Updates**:
  - Added window functions section with examples
  - Added CTEs (Common Table Expressions) section
  - Added subqueries section
  - Enhanced existing sections with more comprehensive examples

### `getting-started.md`
- **Updates**:
  - Added `rowNumber()` window function to the main example
  - Updated imports to include new functions
  - Enhanced example output to show window function results

## New Features Now Documented

### DML Operations
- Full INSERT, UPDATE, DELETE query builder support
- RETURNING clause support for all DML operations
- Multi-dialect compilation for DML

### Advanced SQL Features
- Comprehensive window function support (`rowNumber`, `rank`, `denseRank`, `lag`, `lead`, `firstValue`, `lastValue`, `ntile`)
- Enhanced CTE support with recursive CTEs
- Advanced subquery support

### Relation Types
- `belongsToMany` relation type with pivot table support
- Pivot column hydration with custom alias support

### Dialect Support
- PostgreSQL dialect support
- Dialect-specific feature documentation

### Expression Builders
- Additional comparison operators (`notLike`, `notBetween`)
- Null checking functions (`isNull`, `isNotNull`)
- Enhanced window function helpers

## Verification

All documented features have been verified to exist in the codebase:
- ✅ All DML classes exist and are exported
- ✅ All window functions exist and are exported
- ✅ PostgreSQL dialect exists and is exported
- ✅ `belongsToMany` relation function exists and is exported
- ✅ All utility functions exist and are exported

The documentation now accurately reflects the current state of the MetalORM library with all its advanced features.
