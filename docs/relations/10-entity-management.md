# Entity Management

Relations integrate with the entity management system for change tracking:

## Change Tracking

All relation changes are tracked automatically:

```typescript
const user = await orm.findOne(User, 1);
user.posts.add({ title: 'New Post' }); // Tracked as 'add' change
user.posts.remove(existingPost); // Tracked as 'remove' change
user.profile.set(newProfile); // Tracked as 'attach' change

// All changes are automatically persisted
await orm.flush();
```

## Unit of Work Integration

Relations work seamlessly with the Unit of Work pattern:

```typescript
await orm.transaction(async (trx) => {
  const user = await trx.findOne(User, 1);
  user.posts.add({ title: 'Transactional Post' });
  user.profile.set({ bio: 'Updated bio' });
  // All changes are committed together
});