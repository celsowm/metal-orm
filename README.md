# MetalORM

[![npm version](https://img.shields.io/npm/v/metal-orm.svg)](https://www.npmjs.com/package/metal-orm)
[![license](https://img.shields.io/npm/l/metal-orm.svg)](https://github.com/celsowm/metal-orm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC.svg)](https://www.typescriptlang.org/)

**A TypeScript-first SQL query builder with schema-driven AST, hydrated relations, and multi-dialect compilation.**

MetalORM keeps SQL generation deterministic (CTEs, aggregates, window functions, EXISTS/subqueries) while letting you introspect the AST or reuse builders inside larger queries. It's designed for developers who want the power of raw SQL with the convenience of a modern ORM.

## Philosophy

MetalORM follows these core principles:

- **Type Safety First**: Leverage TypeScript to catch errors at compile time
- **SQL Transparency**: Generate predictable, readable SQL that you can inspect
- **Composition Over Configuration**: Build complex queries by composing simple parts
- **Zero Magic**: Explicit operations with clear AST representation
- **Multi-Dialect Support**: Write once, compile to MySQL, SQLite, or SQL Server

## Features

### Declarative Schema Definition
Define your database structure in TypeScript with full type inference:

```typescript
const users = defineTable(
  'users',
  {
    id: col.int().primaryKey(),
    name: col.varchar(255).notNull(),
    email: col.varchar(255).unique(),
    createdAt: col.timestamp().default('CURRENT_TIMESTAMP')
  },
  {
    posts: hasMany(posts, 'userId'),
    profile: hasOne(profiles, 'userId')
  }
);
```

### Rich Query Building
```typescript
// Simple queries
const simpleQuery = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(eq(users.columns.id, 1))
  .limit(1);

// Complex joins with relations
const complexQuery = new SelectQueryBuilder(users)
  .select({
    userId: users.columns.id,
    userName: users.columns.name,
    postCount: count(posts.columns.id),
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .where(and(
    like(users.columns.name, '%John%'),
    gt(posts.columns.createdAt, new Date('2023-01-01'))
  ))
  .groupBy(users.columns.id)
  .having(gt(count(posts.columns.id), 5))
  .orderBy(count(posts.columns.id), 'DESC');
```

### Advanced SQL Features
```typescript
// CTEs (Common Table Expressions)
const since = new Date();
since.setDate(since.getDate() - 30);

const activeUsers = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(gt(users.columns.lastLogin, since))
  .as('active_users');

const query = new SelectQueryBuilder(activeUsers)
  .with(activeUsers)
  .selectRaw('*')
  .where(eq(activeUsers.columns.id, 1));

// Window Functions
const rankedPosts = new SelectQueryBuilder(posts)
  .select({
    id: posts.columns.id,
    title: posts.columns.title,
    rank: windowFunction('RANK', [], [posts.columns.userId], [
      { column: posts.columns.createdAt, direction: 'DESC' }
    ])
  });

// Subqueries and EXISTS
const usersWithPosts = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(exists(
    new SelectQueryBuilder(posts)
      .selectRaw('1')
      .where(eq(posts.columns.userId, users.columns.id))
  ));
```

### Relation Hydration
Automatically transform flat database rows into nested JavaScript objects:

```typescript
const builder = new SelectQueryBuilder(users)
  .selectRaw('*')
  .include('posts', {
    columns: ['id', 'title', 'content'],
    include: {
      comments: {
        columns: ['id', 'content', 'createdAt']
      }
    }
  });

const { sql, params } = builder.compile(new MySqlDialect());
const rows = await db.execute(sql, params);

// Automatically hydrates to:
// {
//   id: 1,
//   name: 'John',
//   posts: [
//     {
//       id: 1,
//       title: 'First Post',
//       comments: [...]
//     }
//   ]
// }
const hydrated = hydrateRows(rows, builder.getHydrationPlan());
```

### Multi-Dialect Support
Compile the same query to different SQL dialects:

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

Here's a complete example to get you started:

```typescript
import {
  defineTable,
  col,
  hasMany,
  SelectQueryBuilder,
  eq,
  count,
  hydrateRows,
  MySqlDialect
} from 'metal-orm';

// 1. Define your schema
const posts = defineTable(
  'posts',
  {
    id: col.int().primaryKey(),
    title: col.varchar(255).notNull(),
    content: col.text(),
    userId: col.int().notNull(),
    createdAt: col.timestamp().default('CURRENT_TIMESTAMP'),
    updatedAt: col.timestamp()
  }
);

const users = defineTable(
  'users',
  {
    id: col.int().primaryKey(),
    name: col.varchar(255).notNull(),
    email: col.varchar(255).unique(),
    createdAt: col.timestamp().default('CURRENT_TIMESTAMP')
  },
  {
    posts: hasMany(posts, 'userId')
  }
);

// 2. Build your query
const builder = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    email: users.columns.email,
    totalPosts: count(posts.columns.id)
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .groupBy(users.columns.id, users.columns.name, users.columns.email)
  .orderBy(count(posts.columns.id), 'DESC')
  .limit(20)
  .include('posts', {
    columns: [posts.columns.id, posts.columns.title, posts.columns.createdAt]
  });

// 3. Compile to SQL
const dialect = new MySqlDialect();
const { sql, params } = builder.compile(dialect);

// 4. Execute and hydrate
const rows = await connection.execute(sql, params);
const hydrated = hydrateRows(rows, builder.getHydrationPlan());

console.log(hydrated);
// [
//   {
//     id: 1,
//     name: 'John Doe',
//     email: 'john@example.com',
//     totalPosts: 15,
//     posts: [
//       {
//         id: 101,
//         title: 'Latest Post',
//         createdAt: '2023-05-15T10:00:00.000Z'
//       },
//       // ... more posts
//     ]
//   }
//   // ... more users
// ]
```

## Advanced Expression Helpers

### JSON filters and comparisons
```typescript
const userData = defineTable('user_data', {
  id: col.int().primaryKey(),
  userId: col.int().notNull(),
  preferences: col.json().notNull()
});

const jsonQuery = new SelectQueryBuilder(userData)
  .select({
    id: userData.columns.id,
    userId: userData.columns.userId,
    theme: jsonPath(userData.columns.preferences, '$.theme')
  })
  .where(and(
    eq(jsonPath(userData.columns.preferences, '$.theme'), 'dark'),
    inList(userData.columns.userId, [1, 2, 3])
  ));
```

### CASE expressions and window helpers
```typescript
const tieredUsers = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    tier: caseWhen([
      { when: gt(count(posts.columns.id), 10), then: 'power user' }
    ], 'regular')
  })
  .groupBy(users.columns.id);

const rankedPosts = new SelectQueryBuilder(posts)
  .select({
    id: posts.columns.id,
    createdAt: posts.columns.createdAt,
    rank: windowFunction('RANK', [], [posts.columns.userId], [
      { column: posts.columns.createdAt, direction: 'DESC' }
    ])
  });
```

## Performance Considerations

### Query Optimization
- **Use `.select()` explicitly** instead of `select('*')` to only fetch needed columns
- **Leverage CTEs** for complex queries to improve readability and sometimes performance
- **Use indexes** on frequently queried columns and join conditions
- **Reuse compiled hydration plans** when transforming rows to avoid repeating row reconstruction

### Caching Strategies
```typescript
// Implement query result caching
const cache = new Map<string, any>();

async function getUserWithPosts(userId: number) {
  const cacheKey = `user:${userId}:with-posts`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const builder = new SelectQueryBuilder(users)
    .selectRaw('*')
    .where(eq(users.columns.id, userId))
    .include('posts');

  const { sql, params } = builder.compile(dialect);
  const rows = await db.execute(sql, params);
  const result = hydrateRows(rows, builder.getHydrationPlan());

  cache.set(cacheKey, result);
  return result;
}
```

## Comparison with Other ORMs

| Feature                | MetalORM               | TypeORM          | Prisma            | Knex            |
|------------------------|------------------------|------------------|-------------------|------------------|
| Type Safety            | ✅ Full TypeScript     | ✅ Good           | ✅ Excellent       | ❌ Limited         |
| SQL Generation         | ✅ Deterministic       | ❌ ORM-style      | ✅ Good            | ✅ Good           |
| AST Inspection         | ✅ Full access         | ❌ No             | ❌ No              | ❌ No             |
| Multi-Dialect          | ✅ MySQL/SQLite/MSSQL | ✅ Many           | ✅ Many            | ✅ Many           |
| Relation Hydration     | ✅ Automatic           | ✅ Manual         | ✅ Automatic       | ❌ Manual          |
| Query Builder          | ✅ Rich                | ✅ Good           | ❌ Limited         | ✅ Good           |
| Learning Curve         | ⚠️ Moderate           | ⚠️ Moderate      | ✅ Low            | ⚠️ Moderate      |
| Bundle Size            | ✅ Small               | ⚠️ Medium         | ⚠️ Medium         | ✅ Small           |

## Migration Guide

### From Knex
```typescript
// Before (Knex)
const users = await knex('users')
  .select('users.*', knex.raw('COUNT(posts.id) as post_count'))
  .leftJoin('posts', 'users.id', 'posts.user_id')
  .groupBy('users.id')
  .orderBy('post_count', 'desc');

// After (MetalORM)
const users = defineTable('users', { /* ... */ });
const posts = defineTable('posts', { /* ... */ });

const result = await new SelectQueryBuilder(users)
  .select({
    ...allUserColumns,
    postCount: count(posts.columns.id)
  })
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .groupBy(users.columns.id)
  .orderBy(count(posts.columns.id), 'DESC')
  .compile(dialect);
```

### From TypeORM
```typescript
// Before (TypeORM)
const users = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.name LIKE :name', { name: '%John%' })
  .orderBy('user.createdAt', 'DESC')
  .getMany();

// After (MetalORM)
const result = await new SelectQueryBuilder(users)
  .selectRaw('*')
  .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
  .where(like(users.columns.name, '%John%'))
  .orderBy(users.columns.createdAt, 'DESC')
  .include('posts')
  .compile(dialect);
```

## Project Structure

```
metal-orm/
├── src/
│   ├── schema/          # Table/column/relation definitions
│   ├── builder/         # Query builder and managers
│   ├── ast/             # AST nodes and expression builders
│   ├── dialect/         # SQL dialect implementations
│   ├── runtime/         # Hydration and utility functions
│   ├── codegen/         # Code generation helpers
│   └── playground/      # Interactive playground
├── tests/               # Test suites
├── dist/                # Compiled output
└── playground/          # Vite-based playground app
```

## API Documentation

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

## Project Commands

```bash
# Build the project
npm run build

# Type checking
npm run check

# Run tests
npm run test

# Interactive test UI
npm run test:ui

# Launch playground
npm run playground

# Clean build
npm run clean
```

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/celsowm/metal-orm.git
   cd metal-orm
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the playground:**
   ```bash
   npm run playground
   ```
   This launches a Vite-based UI where you can experiment with queries.

4. **Run tests:**
   ```bash
   npm test
   ```

## Contributing

We welcome contributions! Here's how you can help:

### Getting Started
1. Fork the repository
2. Clone your fork and install dependencies
3. Run `npm run playground` to see MetalORM in action

### Development Workflow
1. **Write tests first** - Add test cases in the `tests/` directory
2. **Implement features** - Follow existing code patterns
3. **Update documentation** - Keep docs in sync with changes
4. **Run all checks** - Ensure tests pass and formatting is correct

### Code Guidelines
- Follow existing TypeScript patterns and conventions
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Write comprehensive tests for new features
- Maintain 100% type coverage

### Pull Request Process
1. Create a feature branch from `main`
2. Implement your changes with tests
3. Update documentation as needed
4. Ensure all tests pass (`npm test`)
5. Submit PR with clear description of changes

### Documentation Standards
- Update `ROADMAP.md` for major feature plans
- Add `SOLID_*.md` files for architectural decisions
- Keep API documentation in sync with code changes
- Add examples for new features

## License

MetalORM is [MIT licensed](https://github.com/celsowm/metal-orm/blob/main/LICENSE).

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/celsowm/metal-orm/issues)
- **Discussions**: Join the conversation on [GitHub Discussions](https://github.com/celsowm/metal-orm/discussions)
- **Contributing**: See the [Contributing](#contributing) section above

## Roadmap

Check out our [ROADMAP.md](ROADMAP.md) for upcoming features and long-term vision.

## Examples

See the [playground scenarios](playground/src/data/scenarios/) for comprehensive examples covering:
- Basic CRUD operations
- Complex joins and relations
- Aggregations and window functions
- CTEs and subqueries
- JSON operations
- And much more!

## Who's Using MetalORM?

MetalORM is used in production by various projects. If you're using MetalORM, consider adding your project to this list!

## Acknowledgements

Special thanks to all contributors and the open-source community for their support and feedback.

---

**Star this repo if you find it useful!** ⭐

[GitHub Repository](https://github.com/celsowm/metal-orm) |
[npm package](https://www.npmjs.com/package/metal-orm)
