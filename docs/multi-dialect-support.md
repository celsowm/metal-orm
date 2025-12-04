# Multi-Dialect Support

MetalORM is designed to be database-agnostic. You can write your queries once and compile them to different SQL dialects.

## Compiling Queries

The `compile()` method on the `SelectQueryBuilder` takes a dialect instance and returns the compiled SQL and parameters.

```typescript
const query = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(eq(users.columns.id, 1))
  .limit(10);

// MySQL
const mysql = query.compile(new MySqlDialect());
// SQL: SELECT * FROM users WHERE id = ? LIMIT ?

// SQLite
const sqlite = query.compile(new SQLiteDialect());
// SQL: SELECT * FROM users WHERE id = ? LIMIT ?

// SQL Server
const mssql = query.compile(new MSSQLDialect());
// SQL: SELECT TOP 10 * FROM users WHERE id = @p1
```

## Supported Dialects

- **MySQL**: `MySqlDialect`
- **SQLite**: `SQLiteDialect`
- **SQL Server**: `MSSQLDialect`
- **PostgreSQL**: `PostgresDialect`

Each dialect handles the specific syntax and parameterization of the target database.

### Dialect-Specific Features

```typescript
// PostgreSQL-specific JSON operations
const query = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    settings: jsonPath(users.columns.settings, '$.notifications')
  })
  .compile(new PostgresDialect());

// SQL Server TOP clause vs LIMIT
const limitedQuery = new SelectQueryBuilder(users)
  .selectRaw('*')
  .limit(10);

// MySQL/SQLite/PostgreSQL: SELECT * FROM users LIMIT 10
// SQL Server: SELECT TOP 10 * FROM users
```

> **Note**: When using the runtime (`OrmContext`), the same dialects are used to generate INSERT, UPDATE, DELETE, and pivot operations in `saveChanges()`.
```
