# API Reference

This section provides a reference for the core classes, key functions, and utility functions in MetalORM.

### Core Classes
- `SelectQueryBuilder` - Main query builder class
- `MySqlDialect` / `SQLiteDialect` / `MSSQLDialect` - SQL dialect compilers
- `HydrationManager` - Handles relation hydration logic

### Key Functions
- `defineTable()` - Define database tables
- `col.*()` - Column type definitions
- `hasMany()` / `belongsTo()` - Relation definitions
- `eq()`, `and()`, `or()`, etc. - Expression builders
- `hydrateRows()` - Transform flat rows to nested objects

### Utility Functions
- `count()`, `sum()`, `avg()` - Aggregate functions
- `like()`, `between()`, `inList()`, `notInList()` - Comparison operators
- `jsonPath()` - JSON extraction
- `caseWhen()`, `exists()`, `notExists()` - Conditional and subquery helpers
- `rowNumber()`, `rank()`, `denseRank()`, `lag()`, `lead()`, `windowFunction()` - Window function helpers
