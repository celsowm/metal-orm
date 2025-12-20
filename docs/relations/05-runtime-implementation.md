# Runtime Implementation

Each relation type has a corresponding runtime implementation:

## HasManyCollection

Handles one-to-many relationships with lazy loading and change tracking.

**Methods:**
- `load(): Promise<TChild[]>` - Loads the collection if not already loaded
- `getItems(): TChild[]` - Returns the current items without loading
- `add(data: Partial<TChild>): TChild` - Adds a new entity to the collection
- `attach(entity: TChild): void` - Attaches an existing entity
- `remove(entity: TChild): void` - Removes an entity from the collection
- `clear(): void` - Clears all entities from the collection

**Example Usage:**
```typescript
const user = await orm.findOne(User, 1);
await user.posts.load(); // Load all posts
user.posts.add({ title: 'New Post', content: 'Content' });
user.posts.attach(existingPost);
user.posts.remove(postToRemove);
```

## HasOneReference

Handles one-to-one relationships with lazy loading and change tracking.

**Methods:**
- `load(): Promise<TChild | null>` - Loads the reference if not already loaded
- `get(): TChild | null` - Returns the current value without loading
- `set(data: Partial<TChild> | TChild | null): TChild | null` - Sets the reference

**Example Usage:**
```typescript
const user = await orm.findOne(User, 1);
await user.profile.load(); // Load the profile
user.profile.set({ bio: 'New bio' });
user.profile.set(null); // Remove the reference
```

## BelongsToReference

Handles many-to-one relationships with lazy loading and change tracking.

**Methods:**
- `load(): Promise<TParent | null>` - Loads the reference if not already loaded
- `get(): TParent | null` - Returns the current value without loading
- `set(data: Partial<TParent> | TParent | null): TParent | null` - Sets the reference

**Example Usage:**
```typescript
const post = await orm.findOne(Post, 1);
await post.author.load(); // Load the author
post.author.set({ name: 'New Author' });
```

## ManyToManyCollection

Handles many-to-many relationships with lazy loading and change tracking.

**Methods:**
- `load(): Promise<TTarget[]>` - Loads the collection if not already loaded
- `getItems(): TTarget[]` - Returns the current items without loading
- `attach(target: TTarget | number | string): void` - Attaches an entity
- `detach(target: TTarget | number | string): void` - Detaches an entity
- `syncByIds(ids: (number | string)[]): Promise<void>` - Syncs the collection with a list of IDs

**Example Usage:**
```typescript
const user = await orm.findOne(User, 1);
await user.roles.load(); // Load all roles
user.roles.attach(role); // Attach a role entity
user.roles.attach(1); // Attach by ID
user.roles.detach(role);
await user.roles.syncByIds([1, 2, 3]); // Sync with specific IDs