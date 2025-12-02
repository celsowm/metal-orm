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

## Quick Start

```typescript
import {
  defineTable,
  col,
  SelectQueryBuilder,
  eq,
} from 'metal-orm';

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
});

const query = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(eq(users.columns.id, 1));

console.log(query.compile(new MySqlDialect()).sql);
// SELECT * FROM users WHERE id = ?
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

MetalORM is [MIT licensed](LICENSE).
