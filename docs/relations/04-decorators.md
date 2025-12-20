# Decorators

Metal ORM provides decorators for defining relations on entity properties:

## @HasMany

Defines a one-to-many relationship.

```typescript
@HasMany(options: HasManyOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the target table
- `localKey`: Local key column name (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@HasMany(() => Post, { 
  foreignKey: 'user_id',
  localKey: 'id',
  cascade: 'all'
})
posts: HasManyCollection<Post>;
```

## @HasOne

Defines a one-to-one relationship where the parent has one child.

```typescript
@HasOne(options: HasOneOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the target table
- `localKey`: Local key column name (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@HasOne(() => Profile, { 
  foreignKey: 'user_id',
  cascade: 'persist'
})
profile: HasOneReference<Profile>;
```

## @BelongsTo

Defines a many-to-one relationship.

```typescript
@BelongsTo(options: BelongsToOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `foreignKey`: Foreign key column name on the current table
- `localKey`: Local key column name on target (optional, defaults to primary key)
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@BelongsTo(() => User, { 
  foreignKey: 'user_id',
  localKey: 'id'
})
author: BelongsToReference<User>;
```

## @BelongsToMany

Defines a many-to-many relationship through a pivot table.

```typescript
@BelongsToMany(options: BelongsToManyOptions)
```

**Options:**
- `target`: Target entity constructor or table definition
- `pivotTable`: Pivot table entity constructor or table definition
- `pivotForeignKeyToRoot`: Foreign key column in pivot table pointing to root entity
- `pivotForeignKeyToTarget`: Foreign key column in pivot table pointing to target entity
- `localKey`: Local key column name (optional, defaults to primary key)
- `targetKey`: Target key column name (optional, defaults to primary key)
- `pivotPrimaryKey`: Primary key column name of pivot table
- `defaultPivotColumns`: Default columns to select from pivot table
- `cascade`: Cascade mode for operations

**Example:**
```typescript
@BelongsToMany(() => Role, {
  pivotTable: () => UserRole,
  pivotForeignKeyToRoot: 'user_id',
  pivotForeignKeyToTarget: 'role_id',
  targetKey: 'id',
  defaultPivotColumns: ['assigned_at']
})
roles: ManyToManyCollection<Role>;