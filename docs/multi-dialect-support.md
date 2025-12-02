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

Each dialect handles the specific syntax and parameterization of the target database.
