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
```

## MorphOneReference (Polymorphic One-to-One)

Handles polymorphic one-to-one relationships. Uses the same `HasOneReference` API, but automatically manages both the FK column (`idField`) and the discriminator column (`typeField`).

**Methods:** Same as `HasOneReference` — `load()`, `get()`, `set()`.

**Example Usage:**
```typescript
const user = users[0];
await user.image.load();
user.image.set({ url: '/avatar.png' }); // sets imageableId + imageableType
user.image.set(null);                    // detaches
```

## MorphManyCollection (Polymorphic One-to-Many)

Handles polymorphic one-to-many relationships. Uses the same `HasManyCollection` API, but automatically manages both the FK column (`idField`) and the discriminator column (`typeField`).

**Methods:** Same as `HasManyCollection` — `load()`, `getItems()`, `add()`, `attach()`, `remove()`, `clear()`.

**Example Usage:**
```typescript
const post = posts[0];
await post.comments.load();
post.comments.add({ body: 'Hello!' }); // sets commentableId + commentableType
post.comments.attach(existingComment);
post.comments.remove(comment);
```

## MorphToReference (Polymorphic Inverse)

Handles the inverse of polymorphic relations. Uses the `BelongsToReference` API. The target table is resolved dynamically from the `typeField` value.

**Methods:** Same as `BelongsToReference` — `load()`, `get()`, `set()`.

**Example Usage:**
```typescript
const comment = comments[0];
await comment.commentable.load(); // resolves target from commentableType
const parent = comment.commentable.get(); // could be Post or Video
comment.commentable.set(null);            // clears typeField + idField