# Polymorphic Relations

Polymorphic relations allow a single relation to point to multiple target tables. This is useful when different entity types share a common child table (e.g., comments, images, tags) or when a child needs to reference different parent types.

Metal ORM supports three polymorphic relation types:

| Type | Direction | Target | Use Case |
|------|-----------|--------|----------|
| **MorphOne** | Parent → Child (1:1) | Fixed | A User has one Image (polymorphic) |
| **MorphMany** | Parent → Child (1:N) | Fixed | A Post has many Comments (polymorphic) |
| **MorphTo** | Child → Parent (N:1) | Dynamic | A Comment belongs to a Post or Video |

## How It Works

Polymorphic relations use two columns on the child (morph) table — a **type discriminator** and a **foreign key**:

```sql
-- The "comments" table stores polymorphic references:
CREATE TABLE comments (
  id INT PRIMARY KEY,
  body TEXT,
  commentable_type VARCHAR(50),  -- 'post', 'video', etc.
  commentable_id INT             -- FK to posts.id or videos.id
);
```

When querying, MorphOne/MorphMany add an extra `AND` condition on the discriminator:

```sql
-- MorphMany: posts → comments
SELECT * FROM comments
WHERE commentable_id = posts.id
  AND commentable_type = 'post'
```

---

## Schema-Based Definition

### MorphOne

A parent has exactly one polymorphic child:

```typescript
import { defineTable, col, morphOne } from 'metal-orm';

const images = defineTable('images', {
  id: col.primaryKey(col.int()),
  url: col.varchar(500),
  imageableType: col.varchar(50),
  imageableId: col.int(),
});

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
}, {
  image: morphOne(images, {
    as: 'imageable',       // morph name (prefix for type/id columns)
    typeValue: 'user',     // discriminator value stored in imageableType
  })
});
```

**Parameters:**
- `target` — The morph table (e.g., `images`)
- `as` — The morph name. By default, generates `${as}Type` and `${as}Id` column names
- `typeValue` — The discriminator value persisted in the type column
- `typeField?` — Override the type column name (default: `${as}Type`)
- `idField?` — Override the FK column name (default: `${as}Id`)
- `localKey?` — Override the parent's key (default: primary key)
- `cascade?` — Cascade mode

### MorphMany

A parent has multiple polymorphic children:

```typescript
import { defineTable, col, morphMany } from 'metal-orm';

const comments = defineTable('comments', {
  id: col.primaryKey(col.int()),
  body: col.text(),
  commentableType: col.varchar(50),
  commentableId: col.int(),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
}, {
  comments: morphMany(comments, {
    as: 'commentable',
    typeValue: 'post',
  })
});

const videos = defineTable('videos', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
}, {
  comments: morphMany(comments, {
    as: 'commentable',
    typeValue: 'video',
  })
});
```

### MorphTo

The inverse side — a child that can belong to different parent types:

```typescript
import { defineTable, col, morphTo } from 'metal-orm';

const comments = defineTable('comments', {
  id: col.primaryKey(col.int()),
  body: col.text(),
  commentableType: col.varchar(50),
  commentableId: col.int(),
}, {
  commentable: morphTo({
    typeField: 'commentableType',
    idField: 'commentableId',
    targets: {
      post: posts,    // when commentableType = 'post', load from posts table
      video: videos,  // when commentableType = 'video', load from videos table
    },
  })
});
```

**Parameters:**
- `typeField` — Column that stores the discriminator value
- `idField` — Column that stores the foreign key
- `targets` — Record mapping discriminator values to target table definitions
- `targetKey?` — Override the target's key (default: primary key of each target)
- `cascade?` — Cascade mode

---

## Decorator-Based Definition

### @MorphOne

```typescript
import { Entity, PrimaryKey, Column, MorphOne, col } from 'metal-orm';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @MorphOne({
    target: () => Image,
    morphName: 'imageable',
    typeValue: 'user',
  })
  image!: any; // HasOneReference<Image> at runtime
}
```

**Options:**
- `target` — Target entity constructor or table definition (supports lazy `() => Entity`)
- `morphName` — The morph name (used to derive type/id column names)
- `typeValue` — Discriminator value for this entity
- `typeField?` — Override type column name (default: `${morphName}Type`)
- `idField?` — Override FK column name (default: `${morphName}Id`)
- `localKey?` — Override local key (default: primary key)
- `cascade?` — Cascade mode

### @MorphMany

```typescript
@Entity()
class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @MorphMany({
    target: () => Comment,
    morphName: 'commentable',
    typeValue: 'post',
  })
  comments!: any; // HasManyCollection<Comment> at runtime
}
```

**Options:** Same as `@MorphOne`.

### @MorphTo

```typescript
@Entity()
class Comment {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.text())
  body!: string;

  @Column(col.varchar(50))
  commentableType!: string;

  @Column(col.int())
  commentableId!: number;

  @MorphTo({
    typeField: 'commentableType',
    idField: 'commentableId',
    targets: {
      post: () => Post,
      video: () => Video,
    },
  })
  commentable!: any; // BelongsToReference at runtime
}
```

**Options:**
- `typeField` — Column that stores the discriminator
- `idField` — Column that stores the FK
- `targets` — Record mapping discriminator values to entity constructors/table defs
- `targetKey?` — Override target key (default: primary key)
- `cascade?` — Cascade mode

---

## Runtime Behavior

### MorphOne — `HasOneReference`

MorphOne uses the same `HasOneReference` API as `HasOne`:

```typescript
const user = users[0];
await user.image.load();           // lazy load
const img = user.image.get();      // get current value
user.image.set({ url: '/new.png' }); // creates child with imageableId + imageableType set
user.image.set(null);              // detach
```

When you `set()` a child, Metal ORM automatically sets **both** the FK and discriminator columns:
- `imageableId` = parent's primary key
- `imageableType` = `'user'` (the `typeValue`)

### MorphMany — `HasManyCollection`

MorphMany uses the same `HasManyCollection` API as `HasMany`:

```typescript
const post = posts[0];
await post.comments.load();
post.comments.add({ body: 'Great post!' }); // sets commentableId + commentableType
post.comments.attach(existingComment);
post.comments.remove(comment);
post.comments.clear();
```

### MorphTo — `BelongsToReference`

MorphTo uses the `BelongsToReference` API:

```typescript
const comment = comments[0];
await comment.commentable.load(); // resolves target table from commentableType
const parent = comment.commentable.get(); // could be a Post or Video
comment.commentable.set(null);    // clears typeField + idField
```

---

## Query Builder Integration

### Include (Eager Loading)

MorphOne and MorphMany support eager loading via `include()` and `includeLazy()`:

```typescript
// Eager include via JOIN
const results = await selectFrom(posts)
  .include('comments')
  .execute(session);

// Lazy include
const results = await selectFrom(users)
  .includeLazy('image')
  .execute(session);
```

The generated SQL adds a discriminator condition:

```sql
-- include('comments') on posts
SELECT posts.*, comments.*
FROM posts
LEFT JOIN comments
  ON comments.commentable_id = posts.id
  AND comments.commentable_type = 'post'
```

### MorphTo Include — Batch Loading

MorphTo does **not** support JOIN-based include (since the target table is dynamic). It uses batch loading via `$load()` or `includeLazy()`:

```typescript
const comment = comments[0];
const parent = await comment.$load('commentable');
```

The batch loader:
1. Reads `(typeField, idField)` from all loaded entities
2. Groups IDs by type
3. Runs one query per target type
4. Assembles results using composite keys (`type:id`)

### Restrictions (v1)

| Feature | MorphOne/MorphMany | MorphTo |
|---------|-------------------|---------|
| `include()` (JOIN) | ✅ | ❌ throws |
| `includeLazy()` | ✅ | ✅ |
| `$load()` | ✅ | ✅ |
| `joinRelation()` | ✅ | ❌ throws |
| `whereHas()` | ✅ | ❌ not supported |
| Nested includes | ✅ | ❌ not supported |

---

## Save Graph Support

Polymorphic relations work with `saveGraph()` and `patchGraph()`:

```typescript
// Create a post with polymorphic comments
await session.saveGraph(Post, {
  title: 'My Post',
  comments: [
    { body: 'First comment' },
    { body: 'Second comment' },
  ],
});
// Each comment gets commentableId = post.id, commentableType = 'post'

// MorphOne
await session.saveGraph(User, {
  name: 'Alice',
  image: { url: '/alice.png' },
});
// image gets imageableId = user.id, imageableType = 'user'
```

---

## Change Processing

When entities are flushed via `session.commit()`, the change processor handles morph relations:

**MorphOne/MorphMany** — On `add`/`attach`, sets both `idField` and `typeField` on the child. On `remove`, either nullifies both columns or marks the child for removal (depending on cascade mode).

**MorphTo** — On `attach`, resolves the target type from `relation.targets` and sets `typeField` and `idField` on the root entity. On `remove`, nullifies both columns.

---

## Complete Example

```typescript
import {
  defineTable, col, morphMany, morphOne, morphTo,
  selectFrom, Orm, OrmSession, MySqlDialect, createMysqlExecutor
} from 'metal-orm';

// --- Schema ---

const comments = defineTable('comments', {
  id: col.primaryKey(col.int()),
  body: col.text(),
  commentableType: col.varchar(50),
  commentableId: col.int(),
});

const images = defineTable('images', {
  id: col.primaryKey(col.int()),
  url: col.varchar(500),
  imageableType: col.varchar(50),
  imageableId: col.int(),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
}, {
  comments: morphMany(comments, { as: 'commentable', typeValue: 'post' }),
  image: morphOne(images, { as: 'imageable', typeValue: 'post' }),
});

const videos = defineTable('videos', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
}, {
  comments: morphMany(comments, { as: 'commentable', typeValue: 'video' }),
});

// Add MorphTo on the comments table
comments.relations = {
  commentable: morphTo({
    typeField: 'commentableType',
    idField: 'commentableId',
    targets: { post: posts, video: videos },
  }),
};

// --- Usage ---

const session = new OrmSession({ orm, executor });

// Query posts with their polymorphic comments
const results = await selectFrom(posts)
  .include('comments')
  .execute(session);

for (const post of results) {
  console.log(post.title, post.comments.getItems());
}

// Add a comment to a post
results[0].comments.add({ body: 'New comment!' });
await session.commit();
```
