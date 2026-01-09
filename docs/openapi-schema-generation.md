# OpenAPI Schema Generation

Metal ORM now includes runtime OpenAPI 3.1 schema generation capabilities. This enables automatic API documentation generation directly from your query builders.

## Quick Start

### Basic Usage

```typescript
import { defineTable, col, hasMany, belongsTo, selectFrom } from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
  isActive: col.boolean(),
  createdAt: col.timestamp(),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  content: col.text(),
  userId: col.int(),
  createdAt: col.timestamp(),
});

users.relations = { posts: hasMany(posts, 'userId') };
posts.relations = { author: belongsTo(users, 'userId') };

users.columns.name.notNull = true;
users.columns.email.notNull = true;
posts.columns.title.notNull = true;

// Generate OpenAPI 3.1 schema from query
const qb = selectFrom(users)
  .select('id', 'name', 'email')
  .includePick('posts', ['id', 'title']);

const { output } = qb.getSchema({ mode: 'selected' });

console.log(JSON.stringify(output, null, 2));
```

### Output

`getSchema()` returns a bundle with `output` (response schema) and optional `input` (payload schema).

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "format": "int32"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "nullable": false
    },
    "email": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "nullable": false
    },
    "posts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "format": "int32"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255,
            "nullable": false
          }
        },
        "required": ["id", "title"]
      },
      "nullable": false
    }
  },
  "required": ["id", "name", "email", "posts"]
}
```

## Output Schema Options

### Full Entity Schema

```typescript
const { output } = selectFrom(users).getSchema({ mode: 'full' });
```

Generates schema for ALL columns and relations in the entity.

### Selected Columns Schema

```typescript
const { output } = selectFrom(users)
  .select('id', 'name', 'email')
  .getSchema({ mode: 'selected' });
```

Generates schema only for the columns and relations explicitly selected.

### With Descriptions

```typescript
const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

users.columns.name.comment = 'User full name';
users.columns.id.comment = 'Unique user identifier';

const { output } = selectFrom(users).getSchema({
  mode: 'full',
  includeDescriptions: true
});
```

### Maximum Depth for Relations

```typescript
const { output } = selectFrom(users).getSchema({
  mode: 'full',
  maxDepth: 2
});
```

## Input Schema Options

Input schemas model write payloads (create/update), including nested relations when enabled.
To skip input generation entirely, pass `input: false`.

### Create Payload

```typescript
const { input } = selectFrom(users).getSchema({
  input: {
    mode: 'create',
    excludePrimaryKey: true,
    relationMode: 'mixed'
  }
});
```

### Update Payload

```typescript
const { input } = selectFrom(users).getSchema({
  input: {
    mode: 'update',
    requirePrimaryKey: true,
    relationMode: 'ids'
  }
});
```

**Relation Modes:**
- `ids`: relations accept only primary key values
- `objects`: relations accept only nested objects
- `mixed`: relations accept ids or nested objects

**Other knobs:**
- `omitReadOnly`: skips auto-increment/generated columns (default: true)
- `excludePrimaryKey`: removes primary key columns from input
- `requirePrimaryKey`: requires primary key columns on update payloads

## Advanced Features

### Computed Field Support

The schema extractor automatically detects and handles computed fields (aggregate functions, window functions, CASE expressions, subqueries):

```typescript
const qb = selectFrom(users)
  .select('id', 'name', {
    postCount: count(posts.id),        // aggregate function
    rank: rowNumber()                   // window function
  })
  .includePick('posts', ['id', 'title']);

const { output } = qb.getSchema({ mode: 'selected' });
```

**Automatic Detection:**
- `getSchema()` intelligently detects when your query contains computed fields
- Uses projection-based extraction for queries with computed expressions
- Uses hydration-plan extraction for standard column selections

**Computed Field Mappings:**

| Field Type | OpenAPI Type | Example | Required |
|-----------|---------------|---------|----------|
| Aggregate functions | `number` or `string` | `COUNT`, `SUM`, `AVG`, `GROUP_CONCAT` | COUNT |
| Window functions | `integer` or `string` | `ROW_NUMBER`, `RANK`, `LAG`, `LEAD` | ROW_NUMBER, RANK |
| CASE expressions | `string` | `CASE WHEN ... THEN ... ELSE ...` | - |
| Scalar subqueries | `object` | `(SELECT ...)` | - |

## Integration with API Frameworks

### Example: Generate OpenAPI Spec

```typescript
import { selectFrom } from 'metal-orm';
import { defineTable, col, hasMany } from 'metal-orm';

// Define your entities
// ...

// Generate schema for GET endpoint
const { output: getUsersSchema } = selectFrom(users)
  .select('id', 'name', 'email')
  .getSchema({ mode: 'selected' });

const { output: getPostsSchema } = selectFrom(posts)
  .includePick('author', ['id', 'name'])
  .getSchema({ mode: 'selected' });

// Build OpenAPI 3.1 spec
const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'My API',
    version: '1.0.0'
  },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: getUsersSchema
                }
              }
            }
          }
        }
      }
    }
  },
  '/posts': {
    get: {
      summary: 'List posts with authors',
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: getPostsSchema
              }
            }
          }
        }
      }
    }
  }
  }
};

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('openapi.json', JSON.stringify(openApiSpec, null, 2));
```

## Supported Column Types

| SQL Type | OpenAPI Type | Format |
|----------|---------------|---------|
| `int` / `integer` | `integer` | `int32` |
| `bigint` | `integer` | `int64` |
| `decimal` / `float` / `double` | `number` | - |
| `varchar(n)` | `string` | - (with `maxLength`) |
| `text` | `string` | - |
| `boolean` | `boolean` | - |
| `date` | `string` | `date` |
| `datetime` / `timestamp` | `string` | `date-time` |
| `timestamptz` | `string` | `date-time` |
| `uuid` | `string` | `uuid` |
| `enum([...])` | `string` | (with `enum` array) |
| `json` | `anyOf` | - (object or array) |
| `blob` / `binary` / `varbinary` | `string` | `base64` |

## Relation Mapping

| Relation Type | Schema Type | Nullable |
|--------------|-------------|----------|
| `hasMany` | `array` | false |
| `belongsToMany` | `array` | false |
| `hasOne` | `object` | true |
| `belongsTo` | `object` | true |

## Advanced Features

### Circular References

The schema extractor automatically detects and handles circular references to prevent infinite recursion:

```typescript
const users = defineTable('users', { /* ... */ });
const posts = defineTable('posts', { /* ... */ });

users.relations = { posts: hasMany(posts, 'userId') };
posts.relations = { author: belongsTo(users, 'userId') };

// Automatically handles circular references
const { output } = selectFrom(users).getSchema({ mode: 'full', maxDepth: 2 });
```

### Many-to-Many Relations

Pivot table information is automatically included for many-to-many relations:

```typescript
const users = defineTable('users', { /* ... */ });
const roles = defineTable('roles', { /* ... */ });
const userRoles = defineTable('user_roles', { /* ... */ });

users.relations = {
  roles: belongsToMany(roles, userRoles, {
    pivotForeignKeyToRoot: 'userId',
    pivotForeignKeyToTarget: 'roleId',
  })
};

const { output } = selectFrom(users).getSchema({ mode: 'full' });
// schema.properties.roles includes array of role objects
```

### Decorator Entities

Works seamlessly with decorator-based entities:

```typescript
import { Entity, Column, PrimaryKey, HasMany, BelongsTo, selectFromEntity } from 'metal-orm';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email!: string;

  @HasMany({ target: () => Post, foreignKey: 'userId' })
  posts!: any;
}

@Entity()
class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @Column(col.int())
  userId!: number;

  @BelongsTo({ target: () => User, foreignKey: 'userId' })
  author!: any;
}

// Generate schema from decorator entity
const { output } = selectFromEntity(User)
  .select('id', 'name', 'email')
  .includePick('posts', ['id', 'title'])
  .getSchema({ mode: 'selected' });
```
