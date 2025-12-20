# Best Practices

## 1. Use Appropriate Relation Types

Choose the correct relation type for your use case:

```typescript
// Good: One user has many posts
@HasMany(() => Post, { foreignKey: 'user_id' })
posts: HasManyCollection<Post>;

// Good: Each post belongs to one user
@BelongsTo(() => User, { foreignKey: 'user_id' })
author: BelongsToReference<User>;

// Avoid: Don't use HasMany when you need HasOne
// @HasMany(() => Profile, { foreignKey: 'user_id' }) // Wrong!
// profiles: HasManyCollection<Profile>;
```

## 2. Optimize Query Performance

Use selective inclusion and filtering:

```typescript
// Good: Include only needed columns
.select(User)
.include('posts', {
  columns: ['id', 'title', 'published_at']
});

// Good: Filter related entities
.include('publishedPosts', {
  columns: ['id', 'title'],
  filter: { published: true }
});

// Avoid: Including everything
.include('posts'); // Loads all columns
```

## 3. Use Batch Loading Efficiently

Access relations in loops after initial load:

```typescript
// Good: Efficient batch loading
const users = await orm.select(User).execute();
for (const user of users) {
  const posts = await user.posts.load(); // Single query for all users
}

// Avoid: Individual queries
for (const user of users) {
  const posts = await orm
    .select(Post)
    .where({ user_id: user.id })
    .execute(); // Separate query for each user
}
```

## 4. Configure Cascade Operations Carefully

Use cascade modes to automatically handle related operations:

```typescript
// Good: Cascade persists for dependent data
@HasOne(() => Profile, { 
  foreignKey: 'user_id',
  cascade: 'persist'
})
profile: HasOneReference<Profile>;

// Good: Cascade removes for dependent data
@HasMany(() => Post, { 
  foreignKey: 'user_id',
  cascade: 'remove'
})
posts: HasManyCollection<Post>;

// Good: No cascade for many-to-many
@BelongsToMany(() => Role, {
  pivotTable: () => UserRole,
  pivotForeignKeyToRoot: 'user_id',
  pivotForeignKeyToTarget: 'role_id',
  cascade: 'none'
})
roles: ManyToManyCollection<Role>;
```

## 5. Use Transactions for Complex Operations

Group related relation changes in transactions:

```typescript
await orm.transaction(async (trx) => {
  const user = await trx.findOne(User, 1);
  
  // Multiple relation changes
  user.posts.add({ title: 'Post 1' });
  user.posts.add({ title: 'Post 2' });
  user.profile.set({ bio: 'New bio' });
  
  // All changes committed together
});
```

## 6. Handle Lazy Loading Gracefully

Be aware of when relations are loaded:

```typescript
const user = await orm.findOne(User, 1);

// This doesn't execute a query
const postCount = user.posts.getItems().length;

// This executes a query
const posts = await user.posts.load();

// Check if loaded
if (!user.posts.loaded) {
  await user.posts.load();
}
```

## 7. Use Type Safety

Leverage TypeScript types for better development experience:

```typescript
// Good: Typed relation access
const posts: Post[] = await user.posts.load();
const author: User | null = await post.author.load();

// Good: Type-safe relation creation
const newPost = user.posts.add({
  title: 'New Post',
  content: 'Content'
});
```

## 8. Consider Performance Implications

Be mindful of large collections and consider pagination:

```typescript
// For large collections, consider pagination
const recentPosts = await orm
  .select(Post)
  .where({ user_id: user.id })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .execute();

// Instead of loading all posts
// const allPosts = await user.posts.load();
```

## 9. Use Appropriate Join Types

Choose the right join type for your use case:

```typescript
// Use LEFT join to include entities even without relations
.include('posts', { joinKind: 'LEFT' });

// Use INNER join to filter entities with relations
.include('publishedPosts', { 
  joinKind: 'INNER',
  filter: { published: true }
});
```

## 10. Monitor and Optimize Queries

Use query logging to identify performance issues:

```typescript
const users = await orm
  .select(User)
  .include('posts', { include: ['comments', 'tags'] })
  .log() // Enable query logging
  .execute();