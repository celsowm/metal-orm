# API Reference

This section provides a reference for the core classes, key functions, and utility functions in MetalORM.

### Core Classes
- `SelectQueryBuilder` - Main query builder class
- `InsertQueryBuilder` - INSERT query builder class
- `UpdateQueryBuilder` - UPDATE query builder class
- `DeleteQueryBuilder` - DELETE query builder class
- `MySqlDialect` / `SQLiteDialect` / `MSSQLDialect` / `PostgresDialect` - SQL dialect compilers
- `HydrationManager` - Handles relation hydration logic
- `OrmContext` - Unit of Work context for entities
- `Entity<TTable>` - Entity proxy wrapping table rows
- `HasManyCollection<T>` - Lazy/batched has-many relation wrapper
- `BelongsToReference<T>` - Belongs-to relation wrapper
- `ManyToManyCollection<T>` - Many-to-many relation wrapper with pivot

### Key Functions
- `defineTable()` - Define database tables
- `col.*()` - Column type definitions
- `hasMany()` / `belongsTo()` / `belongsToMany()` - Relation definitions
- `eq()`, `and()`, `or()`, etc. - Expression builders
- `hydrateRows()` - Transform flat rows to nested objects

### Utility Functions
- `count()`, `sum()`, `avg()` - Aggregate functions
- `like()`, `notLike()`, `between()`, `notBetween()`, `inList()`, `notInList()` - Comparison operators
- `jsonPath()` - JSON extraction
- `caseWhen()`, `exists()`, `notExists()` - Conditional and subquery helpers
- `rowNumber()`, `rank()`, `denseRank()`, `lag()`, `lead()`, `firstValue()`, `lastValue()`, `ntile()`, `windowFunction()` - Window function helpers
- `isNull()`, `isNotNull()` - Null checking functions
