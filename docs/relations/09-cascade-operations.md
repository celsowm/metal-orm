# Cascade Operations

Relations support cascade modes to automatically propagate operations:

## Cascade Modes

- `none`: No cascade operations
- `all`: Cascade all operations (persist, update, remove)
- `persist`: Cascade persist operations only
- `remove`: Cascade remove operations only
- `link`: Link entities without cascade operations

## Configuring Cascade Operations

```typescript
// Schema-based
const usersTable = defineTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name'),
  posts: hasMany(postsTable, 'user_id', undefined, 'all') // Cascade all
});

// Decorator-based
@HasMany({
  target: () => Post,
  foreignKey: 'user_id',
  cascade: 'all'
})
posts: HasManyCollection<Post>;
```

## Cascade Behavior

```typescript
const user = await orm.findOne(User, 1);

// With cascade='all', these operations will propagate:
user.posts.add({ title: 'New Post' }); // Post is automatically saved
user.profile = { bio: 'New bio' }; // Profile is automatically saved

// With cascade='remove', removing a user will:
await orm.remove(user); // Also removes all associated posts
