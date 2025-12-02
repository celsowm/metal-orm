# Getting Started

This guide will help you get started with MetalORM.

## Installation

You can install MetalORM using npm, yarn, or pnpm:

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
