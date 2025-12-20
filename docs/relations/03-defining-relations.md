# Defining Relations

Relations can be defined using two approaches:

## 1. Schema-Based Definition

Define relations directly in table definitions:

```typescript
import { defineTable, hasMany, hasOne, belongsTo, belongsToMany } from '@metalorm/core';

const usersTable = defineTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name'),
  // Define relations
  posts: hasMany(postsTable, 'user_id'),
  profile: hasOne(profilesTable, 'user_id')
});

const postsTable = defineTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title'),
  content: text('content'),
  user_id: integer('user_id'),
  // Define relation back to users
  author: belongsTo(usersTable, 'user_id')
});

const usersRolesTable = defineTable('users_roles', {
  user_id: integer('user_id'),
  role_id: integer('role_id'),
  assigned_at: timestamp('assigned_at')
});

const rolesTable = defineTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name'),
  // Define many-to-many relation
  users: belongsToMany(usersTable, usersRolesTable, {
    pivotForeignKeyToRoot: 'role_id',
    pivotForeignKeyToTarget: 'user_id'
  })
});
```

## 2. Decorator-Based Definition

Define relations using decorators on entity classes:

```typescript
import { Entity, HasMany, HasOne, BelongsTo, BelongsToMany } from '@metalorm/core';

@Entity('users')
class User {
  @HasMany(() => Post, { foreignKey: 'user_id' })
  posts: HasManyCollection<Post>;

  @HasOne(() => Profile, { foreignKey: 'user_id' })
  profile: HasOneReference<Profile>;

  @BelongsToMany(() => Role, {
    pivotTable: () => UserRole,
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'role_id'
  })
  roles: ManyToManyCollection<Role>;
}

@Entity('posts')
class Post {
  @BelongsTo(() => User, { foreignKey: 'user_id' })
  author: BelongsToReference<User>;
}

@Entity('roles')
class Role {
  @BelongsToMany(() => User, {
    pivotTable: () => UserRole,
    pivotForeignKeyToRoot: 'role_id',
    pivotForeignKeyToTarget: 'user_id'
  })
  users: ManyToManyCollection<User>;
}