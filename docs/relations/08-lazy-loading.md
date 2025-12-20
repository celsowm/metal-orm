# Lazy Loading

Metal ORM implements efficient lazy loading with batch loading capabilities:

## Automatic Lazy Loading

Relations are automatically lazy-loaded when accessed:

```typescript
const user = await orm.findOne(User, 1);
// Posts are not loaded yet
const posts = await user.posts.load(); // Now they're loaded
```

## Batch Loading

Multiple entities' relations are loaded in efficient batches:

```typescript
const users = await orm.select(User).execute();
// All users' posts will be loaded in a single query when accessed
for (const user of users) {
  const posts = await user.posts.load(); // Uses batch loading
}
```

## Hydration Cache

Relations are cached within the entity context for the current operation:

```typescript
const user = await orm.findOne(User, 1);
await user.posts.load(); // First load executes query
const samePosts = await user.posts.load(); // Uses cache, no query