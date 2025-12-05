# Schema Definition

MetalORM allows you to define your database schema in TypeScript, providing full type inference and a single source of truth for your data structures.

## Defining Tables

You can define a table using the `defineTable` function. It takes the table name, a columns object, and an optional relations object.

```typescript
import { defineTable, col } from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
  email: col.unique(col.varchar(255)),
  createdAt: col.defaultRaw(col.timestamp(), 'CURRENT_TIMESTAMP'),
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

You can compose helper functions to add constraints:

- `col.primaryKey(col.int())`: Marks the column as a primary key.
- `col.notNull(col.varchar(255))`: Adds a `NOT NULL` constraint.
- `col.unique(col.varchar(255))`: Adds a `UNIQUE` constraint.
- `col.default(col.varchar(50), 'user')`: Sets a literal default value.

Additional helpers are available for richer schema metadata:

- `col.autoIncrement(def)`: Marks a column as auto-increment / identity.
- `col.references(def, { table, column, onDelete, onUpdate })`: Adds a foreign key reference.
- `col.check(def, 'expression')`: Attaches an inline `CHECK` constraint.
- `col.defaultRaw(def, 'SQL_EXPRESSION')`: Uses a raw SQL expression as the default value.

## Relations

You can define relations between tables using `hasOne`, `hasMany`, `belongsTo`, and `belongsToMany`:

### One-to-Many Relations

```typescript
import { defineTable, col, hasMany } from 'metal-orm';

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.notNull(col.varchar(255)),
  userId: col.notNull(col.int()),
});

const users = defineTable(
  'users',
  {
    id: col.primaryKey(col.int()),
    name: col.notNull(col.varchar(255)),
  },
  {
    posts: hasMany(posts, 'userId'),
  }
);
```

### One-to-One Relations

```typescript
import { defineTable, col, hasOne } from 'metal-orm';

const profiles = defineTable('profiles', {
  id: col.primaryKey(col.int()),
  userId: col.unique(col.int().notNull()),
  bio: col.text(),
});

const users = defineTable(
  'users',
  {
    id: col.primaryKey(col.int()),
    name: col.notNull(col.varchar(255)),
  },
  {
    profile: hasOne(profiles, 'userId'),
  }
);
```

`hasOne` works like `hasMany` but hydrates a single child row via a `HasOneReference`. Make the foreign key column unique or part of a unique composite key so the database enforces the 1:1 cardinality.

### Many-to-One Relations

```typescript
const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.notNull(col.varchar(255)),
  userId: col.notNull(col.int()),
}, {
  author: belongsTo(users, 'userId')
});
```

### Many-to-Many Relations

```typescript
const projects = defineTable('projects', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
});

const projectAssignments = defineTable('project_assignments', {
  id: col.primaryKey(col.int()),
  userId: col.notNull(col.int()),
  projectId: col.notNull(col.int()),
  role: col.varchar(50),
  assignedAt: col.timestamp(),
});

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
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
