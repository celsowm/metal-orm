# MetalORM

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

**A TypeScript-first SQL query builder with schema-driven AST, hydrated relations, and multi-dialect compilation.**

MetalORM keeps SQL generation deterministic (CTEs, aggregates, window functions, EXISTS/subqueries) while letting you introspect the AST or reuse builders inside larger queries. It's designed for developers who want the power of raw SQL with the convenience of a modern ORM.

## Documentation

For detailed information and API reference, please visit our [full documentation](docs/index.md).

## Features

- **Declarative Schema Definition**: Define your database structure in TypeScript with full type inference.
- **Rich Query Building**: A fluent API to build simple and complex queries.
- **Advanced SQL Features**: Support for CTEs, window functions, subqueries, and more.
- **Relation Hydration**: Automatically transform flat database rows into nested JavaScript objects.
- **Multi-Dialect Support**: Compile the same query to different SQL dialects.

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
| SQL Server | `tedious` | `npm install tedious` |

After installing the driver, pick the matching dialect implementation before compiling the query (`MySqlDialect`, `SQLiteDialect`, `MSSQLDialect`), and execute the resulting SQL string with the driver of your choice.

## Quick Start

```typescript
import mysql from 'mysql2/promise';
import {
  defineTable,
  col,
  SelectQueryBuilder,
  eq,
  hydrateRows,
  MySqlDialect,
} from 'metal-orm';

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
});

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'test',
});

const builder = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
  })
  .where(eq(users.columns.id, 1));

const dialect = new MySqlDialect();
const { sql, params } = builder.compile(dialect);
const [rows] = await connection.execute(sql, params);
const hydrated = hydrateRows(rows as Record<string, unknown>[], builder.getHydrationPlan());

console.log(hydrated);
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

MetalORM is [MIT licensed](LICENSE).
