# Decorators

Metal ORM provides decorators for defining relations on entity properties:

The decorators follow the TC39 Stage 3 specification (TypeScript 5.6+), so they decorate class fields/accessors and rely on the standard `ClassFieldDecoratorContext`. During decoration Metal ORM stores relation metadata inside `context.metadata` (exposed via `Symbol.metadata`), and `@Entity()` reads that bag when the class is finalized—no `experimentalDecorators`, parameter decorators, or Reflect metadata polyfills are required.

## @HasMany

Defines a one-to-many relationship.

```typescript
@HasMany(options: HasManyOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the target table (optional; defaults to `<RootEntity>_id`)
- `localKey`: Local key column name (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@HasMany({
  target: () => Post,
  foreignKey: 'user_id',
  localKey: 'id',
  cascade: 'all'
})
posts: HasManyCollection<Post>;
```

**Default foreign key example:**
```typescript
@HasMany({ target: () => Post })
posts: HasManyCollection<Post>;
```

## @HasOne

Defines a one-to-one relationship where the parent has one child.

```typescript
@HasOne(options: HasOneOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the target table (optional; defaults to `<RootEntity>_id`)
- `localKey`: Local key column name (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@HasOne({
  target: () => Profile,
  foreignKey: 'user_id',
  cascade: 'persist'
})
profile: HasOneReference<Profile>;
```

**Default foreign key example:**
```typescript
@HasOne({ target: () => Profile })
profile: HasOneReference<Profile>;
```

## @BelongsTo

Defines a many-to-one relationship.

```typescript
@BelongsTo(options: BelongsToOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the current table (optional; defaults to `<property>_id`)
- `localKey`: Local key column name on target (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@BelongsTo({
  target: () => User,
  foreignKey: 'user_id',
  localKey: 'id'
})
author: BelongsToReference<User>;
```

**Default foreign key example:**
```typescript
@BelongsTo({ target: () => User })
user: BelongsToReference<User>;
```

## @BelongsToMany

Defines a many-to-many relationship through a pivot table.

```typescript
@BelongsToMany(options: BelongsToManyOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `pivotTable`: Pivot table entity constructor or table definition
- `pivotForeignKeyToRoot`: Foreign key column in pivot table pointing to root entity (optional; defaults to `<RootEntity>_id`)
- `pivotForeignKeyToTarget`: Foreign key column in pivot table pointing to target entity (optional; defaults to `<TargetEntity>_id`)
- `localKey`: Local key column name (optional, defaults to primary key)
- `targetKey`: Target key column name (optional, defaults to primary key)
- `pivotPrimaryKey`: Primary key column name of pivot table
- `defaultPivotColumns`: Default columns to select from pivot table
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@BelongsToMany({
  target: () => Role,
  pivotTable: () => UserRole,
  pivotForeignKeyToRoot: 'user_id',
  pivotForeignKeyToTarget: 'role_id',
  targetKey: 'id',
  defaultPivotColumns: ['assigned_at']
})
roles: ManyToManyCollection<Role>;
```

**Default pivot key example:**
```typescript
@BelongsToMany({
  target: () => Role,
  pivotTable: () => UserRole
})
roles: ManyToManyCollection<Role>;
```

When you query the relation (e.g., with `include()`/`includePick()`), the `pivot` include option accepts the same columns plus a `merge: true` flag. That flag copies the pivot fields onto the hydrated child objects (while `_pivot` still exists) without overwriting any keys that already exist on the target entity. See the [Query Builder docs](./06-query-builder-integration.md) for examples.

## @MorphOne

Defines a polymorphic one-to-one relationship where the parent has one child from a shared morph table.

```typescript
@MorphOne(options: MorphOneOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `morphName`: The morph name (used to derive `${morphName}Type` and `${morphName}Id` column names)
- `typeValue`: Discriminator value stored in the type column for this entity
- `typeField`: Override the type column name (optional, defaults to `${morphName}Type`)
- `idField`: Override the FK column name (optional, defaults to `${morphName}Id`)
- `localKey`: Local key column name (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@MorphOne({
  target: () => Image,
  morphName: 'imageable',
  typeValue: 'user',
})
image!: any; // HasOneReference<Image> at runtime
```

## @MorphMany

Defines a polymorphic one-to-many relationship where the parent has many children from a shared morph table.

```typescript
@MorphMany(options: MorphManyOptions)
```

**Options:** Same as `@MorphOne`.

**Example:**
```typescript
@MorphMany({
  target: () => Comment,
  morphName: 'commentable',
  typeValue: 'post',
  cascade: 'all'
})
comments!: any; // HasManyCollection<Comment> at runtime
```

## @MorphTo

Defines the inverse of a polymorphic relation — a child that can belong to different parent types.

```typescript
@MorphTo(options: MorphToOptions)
```

**Options:**
- `typeField`: Column that stores the discriminator value
- `idField`: Column that stores the foreign key
- `targets`: Record mapping discriminator values to entity constructors or table definitions
- `targetKey`: Override target key (optional, defaults to primary key of each target)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@MorphTo({
  typeField: 'commentableType',
  idField: 'commentableId',
  targets: {
    post: () => Post,
    video: () => Video,
  },
})
commentable!: any; // BelongsToReference at runtime
```

> **Note:** MorphTo does not support JOIN-based `include()`. Use lazy loading (`$load()` or `includeLazy()`) instead.

See [Polymorphic Relations](./14-polymorphic-relations.md) for the complete guide with examples.
