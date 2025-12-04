# Schema Definition

MetalORM allows you to define your database schema in TypeScript, providing full type inference and a single source of truth for your data structures.

## Defining Tables

You can define a table using the `defineTable` function. It takes the table name, a columns object, and an optional relations object.

```typescript
import { defineTable, col } from 'metal-orm';

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
  email: col.varchar(255).unique(),
  createdAt: col.timestamp().default('CURRENT_TIMESTAMP'),
});
```

## Column Types

MetalORM provides a variety of column types through the `col` object:

- `col.int()`: Integer
- `col.varchar(length)`: Variable-length string
- `col.text()`: Text
- `col.timestamp()`: Timestamp
- `col.json()`: JSON
- ...and more.

You can also chain modifiers to define column constraints:

- `.primaryKey()`: Marks the column as a primary key.
- `.notNull()`: Adds a `NOT NULL` constraint.
- `.unique()`: Adds a `UNIQUE` constraint.
- `.default(value)`: Sets a default value.

## Relations

You can define relations between tables using `hasMany`, `belongsTo`, and `belongsToMany`:

### One-to-Many Relations

```typescript
import { defineTable, col, hasMany } from 'metal-orm';

const posts = defineTable('posts', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  userId: col.int().notNull(),
});

const users = defineTable(
  'users',
  {
    id: col.int().primaryKey(),
    name: col.varchar(255).notNull(),
  },
  {
    posts: hasMany(posts, 'userId'),
  }
);
```

### Many-to-One Relations

```typescript
const posts = defineTable('posts', {
  id: col.int().primaryKey(),
  title: col.varchar(255).notNull(),
  userId: col.int().notNull(),
}, {
  author: belongsTo(users, 'userId')
});
```

### Many-to-Many Relations

```typescript
const projects = defineTable('projects', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
});

const projectAssignments = defineTable('project_assignments', {
  id: col.int().primaryKey(),
  userId: col.int().notNull(),
  projectId: col.int().notNull(),
  role: col.varchar(50),
  assignedAt: col.timestamp(),
});

const users = defineTable('users', {
  id: col.int().primaryKey(),
  name: col.varchar(255).notNull(),
}, {
  projects: belongsToMany(
    projects,
    projectAssignments,
    {
      pivotForeignKeyToRoot: 'userId',
      pivotForeignKeyToTarget: 'projectId',
      defaultPivotColumns: ['role', 'assignedAt']
    }
  )
});

> **Note**: When using the runtime, relation definitions (`hasMany`, `belongsTo`, `belongsToMany`) are also used to:
> - generate hydration plans for eager loading
> - configure lazy relation loaders
> - control cascade behavior in `OrmContext.saveChanges()`.
```
