# DML Operations

MetalORM provides comprehensive support for Data Manipulation Language (DML) operations including INSERT, UPDATE, and DELETE queries.

## INSERT Operations

The `InsertQueryBuilder` allows you to insert data into your tables with full type safety.

### Basic Insert

```typescript
import { InsertQueryBuilder } from 'metal-orm';

const query = new InsertQueryBuilder(users)
  .values({
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date()
  });

const { sql, params } = query.compile(new MySqlDialect());
```

### Multi-row Insert

```typescript
const query = new InsertQueryBuilder(users)
  .values([
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Smith', email: 'jane@example.com' }
  ]);
```

### RETURNING Clause

Some databases support returning inserted data:

```typescript
const query = new InsertQueryBuilder(users)
  .values({ name: 'John Doe', email: 'john@example.com' })
  .returning(users.columns.id, users.columns.name);
```

## UPDATE Operations

The `UpdateQueryBuilder` provides a fluent API for updating records.

### Basic Update

```typescript
const query = new UpdateQueryBuilder(users)
  .set({ name: 'John Updated', email: 'john.updated@example.com' })
  .where(eq(users.columns.id, 1));
```

### Conditional Update

```typescript
const query = new UpdateQueryBuilder(users)
  .set({ lastLogin: new Date() })
  .where(and(
    eq(users.columns.id, 1),
    isNull(users.columns.deletedAt)
  ));
```

### RETURNING Clause

```typescript
const query = new UpdateQueryBuilder(users)
  .set({ status: 'active' })
  .where(eq(users.columns.id, 1))
  .returning(users.columns.id, users.columns.status);
```

## DELETE Operations

The `DeleteQueryBuilder` allows you to delete records with safety.

### Basic Delete

```typescript
const query = new DeleteQueryBuilder(users)
  .where(eq(users.columns.id, 1));
```

### Conditional Delete

```typescript
const query = new DeleteQueryBuilder(users)
  .where(and(
    eq(users.columns.status, 'inactive'),
    lt(users.columns.lastLogin, new Date('2023-01-01'))
  ));
```

### RETURNING Clause

```typescript
const query = new DeleteQueryBuilder(users)
  .where(eq(users.columns.id, 1))
  .returning(users.columns.id, users.columns.name);
```

## Multi-Dialect Support

All DML operations support the same multi-dialect compilation as SELECT queries:

```typescript
// MySQL
const mysqlResult = query.compile(new MySqlDialect());

// SQLite
const sqliteResult = query.compile(new SQLiteDialect());

// SQL Server
const mssqlResult = query.compile(new MSSQLDialect());

// PostgreSQL
const postgresResult = query.compile(new PostgresDialect());
```

## Best Practices

1. **Always use WHERE clauses**: For UPDATE and DELETE operations, always include WHERE clauses to avoid accidental mass updates/deletes.

2. **Use RETURNING for verification**: When supported by your database, use RETURNING clauses to verify what was affected.

3. **Batch operations**: For large datasets, consider batching INSERT operations to avoid parameter limits.

4. **Transaction safety**: Wrap DML operations in transactions when performing multiple related operations.
