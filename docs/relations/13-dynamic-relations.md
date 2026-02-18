# Dynamic (On-the-Fly) Relations

Sometimes you need to add a relation **after** the schema or entity class has already been defined — for example, in a plugin system, a multi-tenant setup, or when building relations dynamically at application startup. Metal ORM provides two functions for this.

---

## `addRelation` — Schema-style tables

Use this when your tables are defined with `defineTable`.

```ts
import { addRelation, hasMany, hasOne, belongsTo, belongsToMany } from 'metal-orm';
```

### Signature

```ts
function addRelation(
  table: TableDef,
  name: string,
  relation: RelationDef
): void
```

- **`table`** — any existing `TableDef` created with `defineTable`.
- **`name`** — the relation key used in `.include()` and hydration (e.g. `'comments'`).
- **`relation`** — a fully-resolved relation definition built with `hasMany`, `hasOne`, `belongsTo`, or `belongsToMany`.

### Examples

```ts
import { defineTable, addRelation, hasMany, hasOne, belongsTo } from 'metal-orm';
import { col } from 'metal-orm';

const commentsTable = defineTable('comments', {
  id: col.primaryKey(col.int()),
  body: col.text(),
  post_id: col.int(),
});

const postsTable = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
});

// Add a hasMany relation at any point after table creation
addRelation(postsTable, 'comments', hasMany(commentsTable, 'post_id'));

// Add a belongsTo relation
addRelation(commentsTable, 'post', belongsTo(postsTable, 'post_id'));
```

After calling `addRelation`, the relation is immediately available for query building and hydration:

```ts
const qb = new SelectQueryBuilder(postsTable).include('comments');
// ✅ Works — the relation was just added dynamically
```

### Overwriting a relation

Calling `addRelation` with the same `name` **replaces** the previous definition:

```ts
addRelation(postsTable, 'comments', hasMany(commentsTable, 'post_id'));
addRelation(postsTable, 'comments', hasMany(archivedCommentsTable, 'post_id')); // replaces the first
```

---

## `addEntityRelation` — Decorator-based entities

Use this when your entities are defined with `@Entity` / `@Column` decorators.

```ts
import { addEntityRelation, RelationKinds } from 'metal-orm';
```

### Signature

```ts
function addEntityRelation(
  ctor: EntityConstructor,
  name: string,
  relation: RelationMetadata
): void
```

- **`ctor`** — the decorated entity class.
- **`name`** — the relation property name (used in `.include()` and hydration).
- **`relation`** — relation metadata using the same format as the decorator options, plus a `kind` discriminant.

### `RelationMetadata` shape

| Field | Type | Notes |
|---|---|---|
| `kind` | `RelationKinds.*` | `HasMany`, `HasOne`, `BelongsTo`, or `BelongsToMany` |
| `propertyKey` | `string` | Same as `name` |
| `target` | `() => EntityConstructor \| TableDef` | Lazy resolver for the target entity/table |
| `foreignKey` | `string` | Required for `BelongsTo`; optional for others (defaults to `<rootName>_id`) |
| `localKey` | `string?` | Override the local primary key |
| `cascade` | `CascadeMode?` | `'none' \| 'all' \| 'persist' \| 'remove' \| 'link'` |
| `pivotTable` | `() => EntityConstructor \| TableDef` | **BelongsToMany only** — the pivot table resolver |
| `pivotForeignKeyToRoot` | `string?` | **BelongsToMany only** |
| `pivotForeignKeyToTarget` | `string?` | **BelongsToMany only** |

### Examples

```ts
import { Entity, Column, bootstrapEntities, addEntityRelation, RelationKinds } from 'metal-orm';

@Entity({ tableName: 'users' })
class User {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'varchar' }) name!: string;
}

@Entity({ tableName: 'posts' })
class Post {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'int' }) user_id!: number;
}
```

#### Before `bootstrapEntities()`

```ts
// Add the relation BEFORE bootstrap — it will be compiled during bootstrapEntities()
addEntityRelation(User, 'posts', {
  kind: RelationKinds.HasMany,
  propertyKey: 'posts',
  target: () => Post,
  foreignKey: 'user_id',
});

bootstrapEntities();
// User's table now has the 'posts' relation ✅
```

#### After `bootstrapEntities()`

```ts
bootstrapEntities();

// Add the relation AFTER bootstrap — the table is patched immediately
addEntityRelation(User, 'posts', {
  kind: RelationKinds.HasMany,
  propertyKey: 'posts',
  target: () => Post,
  foreignKey: 'user_id',
});
// User's table now has the 'posts' relation ✅
```

Both timings are safe — `addEntityRelation` handles them transparently.

### BelongsToMany example

```ts
@Entity({ tableName: 'roles' })
class Role {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'varchar' }) name!: string;
}

@Entity({ tableName: 'user_roles' })
class UserRole {
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'int' }) role_id!: number;
}

bootstrapEntities();

addEntityRelation(User, 'roles', {
  kind: RelationKinds.BelongsToMany,
  propertyKey: 'roles',
  target: () => Role,
  pivotTable: () => UserRole,
  pivotForeignKeyToRoot: 'user_id',
  pivotForeignKeyToTarget: 'role_id',
});
```

### Error handling

`addEntityRelation` throws if the entity class was **not** decorated with `@Entity`:

```ts
class Plain {}

addEntityRelation(Plain, 'things', { ... });
// ❌ Error: Entity 'Plain' is not registered. Did you decorate it with @Entity?
```

---

## Comparison

| | `addRelation` | `addEntityRelation` |
|---|---|---|
| Works on | `TableDef` (schema-style) | Decorated entity classes |
| Input | Resolved `RelationDef` | `RelationMetadata` (decorator format) |
| Timing | Always immediate | Before or after bootstrap |
| Auto-exported | ✅ | ✅ |

---

## Use cases

- **Plugin/module systems** — a plugin registers extra relations on existing tables when it loads.
- **Multi-tenancy** — add tenant-scoped relations at runtime based on config.
- **Testing** — wire up relations in test setup without modifying source files.
- **Code generation** — programmatically build a schema from an external source (e.g. a DB introspection result) and attach relations as they are discovered.
