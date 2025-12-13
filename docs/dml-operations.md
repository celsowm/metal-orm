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

### Insert from SELECT

MetalORM supports `INSERT INTO … SELECT …` to populate one table from another query.

```typescript
const recentOrders = new SelectQueryBuilder(orders)
  .select({
    userId: orders.columns.user_id,
    status: orders.columns.status
  })
  .where(eq(orders.columns.status, 'pending'));

const query = new InsertQueryBuilder(users)
  .columns(users.columns.id, users.columns.role)
  .fromSelect(recentOrders);
```

The builder automatically reuses the select SQL (no need to copy / paste); don’t mix `.fromSelect()` with `.values()`.

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

### UPDATE … FROM / JOIN

`UpdateQueryBuilder` can pull data from related tables before updating:

```typescript
const query = new UpdateQueryBuilder(users)
  .from(orders)
  .join(
    profiles,
    eq(profiles.columns.user_id, orders.columns.user_id)
  )
  .set({ role: 'vip' })
  .where(eq(users.columns.id, orders.columns.user_id));
```

`.from()` accepts table definitions or table expressions, `.join()` mirrors the `SelectQueryBuilder` helpers, and `.as(alias)` lets you rename the target table when the dialect demands it.

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

### DELETE … USING / JOIN

MetalORM emits `USING` clauses on dialects that support them (Postgres, MySQL), while SQL Server falls back to the `DELETE target FROM … JOIN …` pattern. Use `.using()` to register the secondary tables and `.join()` to add further expressions:

```typescript
const query = new DeleteQueryBuilder(users)
  .using(orders)
  .join(
    profiles,
    eq(profiles.columns.user_id, orders.columns.user_id)
  )
  .where(eq(orders.columns.status, 'archived'));
```

Omit `.using()` when targeting SQL Server and rely on `.join()` only; MetalORM will throw a meaningful error if you try to compile a `USING` clause against MSSQL.

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

## Using the Unit of Work (optional)

If you're using `OrmContext`, you don't have to manually build `InsertQueryBuilder` / `UpdateQueryBuilder` / `DeleteQueryBuilder` for every change.

Instead, you can:

1. Load entities via the query builder + `execute(ctx)`.
2. Modify fields and relations in memory.
3. Call `ctx.saveChanges()` once.

```ts
const [user] = await new SelectQueryBuilder(users)
  .select({ id: users.columns.id, name: users.columns.name })
  .includeLazy('posts')
  .where(eq(users.columns.id, 1))
  .execute(ctx);

user.name = 'Updated Name';
user.posts.add({ title: 'New from runtime' });

await ctx.saveChanges();
```

Internally, MetalORM uses the same DML ASTs and dialect compilers described above to generate INSERT, UPDATE, DELETE, and pivot operations.
