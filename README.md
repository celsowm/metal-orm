# MetalORM

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

**A TypeScript-first SQL query builder with schema-driven AST, hydrated relations, and multi-dialect compilation.**

MetalORM keeps SQL generation deterministic (CTEs, aggregates, window functions, EXISTS/subqueries) while letting you introspect the AST or reuse builders inside larger queries. It's designed for developers who want the power of raw SQL with the convenience of a modern ORM.

## Documentation

For detailed information and API reference, please visit our [full documentation](docs/index.md).

- [Getting Started](docs/getting-started.md)
- [Schema Definition](docs/schema-definition.md)
- [Query Builder](docs/query-builder.md)
- [DML Operations](docs/dml-operations.md)
- [Advanced Features](docs/advanced-features.md)
- [Relation Hydration](docs/hydration.md)
- [Multi-Dialect Support](docs/multi-dialect-support.md)
- [API Reference](docs/api-reference.md)

## Features

- **Declarative Schema Definition**: Define your database structure in TypeScript with full type inference.
- **Rich Query Building**: A fluent API to build simple and complex queries.
- **Advanced SQL Features**: Support for CTEs, window functions, subqueries, and more.
- **Relation Hydration**: Automatically transform flat database rows into nested JavaScript objects.
- **Multi-Dialect Support**: Compile the same query to different SQL dialects (MySQL, SQLite, PostgreSQL, SQL Server).
- **DML Operations**: Full support for INSERT, UPDATE, and DELETE operations with RETURNING clauses.
- **Comprehensive Relations**: One-to-many, many-to-one, and many-to-many relationships with pivot table support.
- **Window Functions**: Built-in support for ROW_NUMBER(), RANK(), LAG(), LEAD(), and more.
- **Type Safety**: Full TypeScript support with compile-time error checking.
- **AST Inspection**: Examine and reuse query ASTs for complex query composition.

## Installation

```bash
# npm
npm install metal-orm

# yarn
yarn add metal-orm

# pnpm
pnpm add metal-orm
```

## Database Drivers

MetalORM compiles SQL; it does not bundle a database driver. Install one that matches your database, compile your query with the matching dialect, and hand the SQL + parameters to the driver.

| Dialect | Driver | Install |
| --- | --- | --- |
| MySQL / MariaDB | `mysql2` | `npm install mysql2` |
| SQLite | `sqlite3` | `npm install sqlite3` |
| PostgreSQL | `pg` | `npm install pg` |
| SQL Server | `tedious` | `npm install tedious` |

After installing the driver, pick the matching dialect implementation before compiling the query (`MySqlDialect`, `SQLiteDialect`, `PostgresDialect`, `MSSQLDialect`), and execute the resulting SQL string with the driver of your choice.

## Quick Start

```typescript
import mysql from 'mysql2/promise';
import {
  defineTable,
  col,
  hasMany,
  SelectQueryBuilder,
  eq,
  count,
  rowNumber,
  hydrateRows,
  MySqlDialect,
} from 'metal-orm';

// Define your schema with relations
const posts = defineTable('posts', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  userId: col.int().notNull(),
  createdAt: col.timestamp().default('CURRENT_TIMESTAMP'),
});

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
  email: col.varchar(255).unique(),
}, {
  posts: hasMany(posts, 'userId')
});

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'test',
});

// Build a query with window functions and relations
const builder = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    email: users.columns.email,
    postCount: count(posts.columns.id),
    rank: rowNumber(), // Window function
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .groupBy(users.columns.id, users.columns.name, users.columns.email)
  .orderBy(count(posts.columns.id), 'DESC')
  .limit(10)
  .include('posts', {
    columns: [posts.columns.id, posts.columns.title]
  });

const dialect = new MySqlDialect();
const { sql, params } = builder.compile(dialect);
const [rows] = await connection.execute(sql, params);
const hydrated = hydrateRows(rows as Record<string, unknown>[], builder.getHydrationPlan());

console.log(hydrated);
// [
//   {
//     id: 1,
//     name: 'John Doe',
//     email: 'john@example.com',
//     postCount: 15,
//     rank: 1,
//     posts: [
//       { id: 101, title: 'Latest Post' },
//       // ... more posts
//     ]
//   }
//   // ... more users
// ]
```

## DML Operations

MetalORM provides comprehensive support for INSERT, UPDATE, and DELETE operations:

```typescript
import { InsertQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from 'metal-orm';

// INSERT with RETURNING clause
const insertQuery = new InsertQueryBuilder(users)
  .values({ name: 'John Doe', email: 'john@example.com' })
  .returning(users.columns.id, users.columns.name);

// UPDATE with conditions
const updateQuery = new UpdateQueryBuilder(users)
  .set({ status: 'active' })
  .where(eq(users.columns.id, 1))
  .returning(users.columns.id);

// DELETE with safety
const deleteQuery = new DeleteQueryBuilder(users)
  .where(eq(users.columns.id, 1))
  .returning(users.columns.id, users.columns.name);
```

## Helper idea

If you find yourself compiling/executing the same way across your app, wrap the compiler + driver interaction in a tiny helper instead of repeating it:

```typescript
async function runMetalQuery<T>(
  builder: SelectQueryBuilder<T>,
  connection: mysql.Connection,
  dialect = new MySqlDialect()
) {
  const { sql, params } = builder.compile(dialect);
  const [rows] = await connection.execute(sql, params);
  return hydrateRows(rows as Record<string, unknown>[], builder.getHydrationPlan());
}

const results = await runMetalQuery(builder, connection);
```

This keeps the ORM-focused pieces in one place while letting you reuse any pooling/transaction strategy the driver provides.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

MetalORM is [MIT licensed](LICENSE).
