# Save Graph

The `saveGraph` feature in MetalORM allows you to persist an entire graph of interconnected entities (root entity and its relations) in a single operation. This is particularly useful for handling complex object graphs where you need to create or update multiple related entities simultaneously.

## How it Works

`saveGraph` takes an entity class and a payload (a DTO) that represents the entity and its nested relations. It determines whether to insert or update entities based on the presence of a primary key in the payload. It also handles attaching/upserting related entities based on the provided data.

The payload is now typed: `OrmSession.saveGraph()` accepts `SaveGraphInputPayload<InstanceType<TEntity>>`, inferred from your entity class (columns + relation properties), so typos like `{ nam: '...' }` are caught by TypeScript.

## Example: Persisting an Author and Their Works

Let's consider a scenario where we have `Author`, `Profile`, `Book`, and `Project` entities with the following relationships:

- An `Author` has one `Profile` (`HasOne`).
- An `Author` has many `Books` (`HasMany`).
- An `Author` can belong to many `Projects` (`BelongsToMany`).

### Entity Definitions

```typescript
import {
  Entity,
  Column,
  PrimaryKey,
  HasMany,
  HasOne,
  BelongsTo,
  BelongsToMany,
  col,
} from 'metal-orm';
import type { HasManyCollection, HasOneReference, ManyToManyCollection } from 'metal-orm';

@Entity()
class Profile {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  author_id!: number;

  @Column(col.varchar(255))
  biography!: string;

  @BelongsTo({ target: () => Author, foreignKey: 'author_id' })
  author!: Author;
}

@Entity()
class Book {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  author_id!: number;

  @Column(col.varchar(255))
  title!: string;

  @BelongsTo({ target: () => Author, foreignKey: 'author_id' })
  author!: Author;
}

@Entity()
class Project {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;
}

@Entity()
class AuthorProject {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  author_id!: number;

  @Column(col.int())
  project_id!: number;
}

@Entity()
class Author {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @HasMany({ target: () => Book, foreignKey: 'author_id' })
  books!: HasManyCollection<Book>;

  @HasOne({ target: () => Profile, foreignKey: 'author_id' })
  profile!: HasOneReference<Profile>;

  @BelongsToMany({
    target: () => Project,
    pivotTable: () => AuthorProject,
    pivotForeignKeyToRoot: 'author_id',
    pivotForeignKeyToTarget: 'project_id'
  })
  projects!: ManyToManyCollection<Project>;
}

// Don't forget to bootstrap your entities!
// bootstrapEntities();
```

### Saving a New Graph

To save a new `Author` along with their `Profile`, `Books`, and `Projects`, you can pass a nested DTO to `session.saveGraph`:

```typescript
import { OrmSession } from 'metal-orm';
import type { SaveGraphInputPayload } from 'metal-orm';
// Assuming Author, Book, Profile, Project, AuthorProject are defined and bootstrapped

async function createAuthor(session: OrmSession) {
  const payload: SaveGraphInputPayload<Author> = {
    name: 'J.K. Rowling',
    profile: { biography: 'Fantasy writer' },
    books: [
      { title: 'The Philosopher\'s Stone' },
      { title: 'Chamber of Secrets' }
    ],
    projects: [
      // BelongsToMany accepts ids or nested objects
      1,
      { name: 'Fantastic Beasts' }
    ]
  };

  const author = await session.saveGraph(Author, payload);

  console.log('Created Author:', author.name);
  console.log('Profile:', author.profile.get()?.biography);
  console.log('Books:', author.books.getItems().map(b => b.title));
  console.log('Projects:', author.projects.getItems().map(p => p.name));
}
```

In this example, `saveGraph` will:
- Insert a new `Author` record.
- Insert a new `Profile` record, linked to the `Author`.
- Insert two `Book` records, linked to the `Author`.
- Insert a new `Project` record and create an entry in the `AuthorProject` pivot table to link it to the `Author`.

### Updating an Existing Graph

You can also update an existing graph. If an entity in the payload includes its primary key, `saveGraph` will update the existing record instead of creating a new one.

Consider updating J.K. Rowling's books. We want to update an existing book and remove another:

```typescript
async function updateAuthor(session: OrmSession, authorId: number, firstBookId: number) {
  const updatePayload = {
    id: authorId,
    name: 'J.K. Rowling',
    books: [
      { id: firstBookId, title: 'The Philosopher\'s Stone (Updated)' }
    ]
  };

  // Using pruneMissing: true will delete books not present in the payload
  await session.saveGraph(Author, updatePayload, { pruneMissing: true });

  console.log('Updated Author and books.');
  // Verify changes by re-fetching or inspecting the returned entity
}
```

With `pruneMissing: true`:
- The book with `id: firstBookId` will be updated.
- Any other books previously associated with this author that are *not* present in the `books` array of the `updatePayload` will be deleted.

If `pruneMissing` is `false` (default), only the specified books would be updated or inserted, and other existing books would remain untouched.

## SaveGraph Options

`session.saveGraph` accepts an optional `SaveGraphSessionOptions` object:

```typescript
interface SaveGraphSessionOptions extends SaveGraphOptions {
  transactional?: boolean; // Default: true. Wraps the save operation in a transaction.
  flush?: boolean; // Default: false. Flushes after saveGraph when not transactional.
  pruneMissing?: boolean; // Default: false. Deletes related entities not present in the payload.
  coerce?: 'json' | 'json-in'; // Optional. Coerces JSON-friendly values for date-like columns.
}
```

- `transactional`: If `true`, the entire `saveGraph` operation will be wrapped in a database transaction, ensuring atomicity. If any part of the save fails, all changes are rolled back.
- `flush`: If `true` and `transactional` is `false`, `saveGraph` will call `session.flush()` after applying the graph.
- `pruneMissing`: When `true`, for `HasMany` and `BelongsToMany` relations, any related entities that exist in the database but are not included in the payload will be deleted. Use with caution, as this can lead to data loss if not intended.
- `coerce: 'json'`: Currently converts `Date` values in the payload into ISO strings for DATE/DATETIME/TIMESTAMP/TIMESTAMPTZ columns (it does not parse strings into `Date`).
- `coerce: 'json-in'`: Parses string/number values into `Date` objects for DATE/DATETIME/TIMESTAMP/TIMESTAMPTZ columns (invalid strings throw with the column name).

## Convenience Helpers

```typescript
// Defaults for a session (merged with per-call options)
session.withSaveGraphDefaults({ coerce: 'json', transactional: false, flush: true });

// Save + flush shortcut (defaults to { transactional: false, flush: true })
await session.saveGraphAndFlush(Post, payload);

// Update only: returns null if the row does not exist (requires a primary key in the payload)
const updated = await session.updateGraph(Post, { id: 123, title: 'Updated' });
```

Example using string dates with `coerce: 'json-in'`:

```typescript
const payload = { occurredAt: '2025-01-01T00:00:00.000Z' };
const event = await session.saveGraph(Event, payload, { coerce: 'json-in' });

console.log(event.occurredAt instanceof Date); // true
```

## Patch Graph

The `patchGraph` method provides partial update semantics for entities and their relations. Unlike `saveGraph`, which can create or update entire graphs, `patchGraph` only updates the fields explicitly provided in the payload while leaving other fields unchanged. This is ideal for scenarios where you want to update specific properties without affecting the rest of the entity.

### Key Differences from saveGraph

| Feature | `saveGraph` | `patchGraph` |
|---------|-------------|--------------|
| Primary Key Required | Optional (creates if missing) | **Required** |
| Update Behavior | Updates all provided fields | Updates only provided fields |
| Non-existent Entity | Creates new entity | Returns `null` |
| Use Case | Create or update full graphs | Partial updates on existing entities |

### Basic Usage

To patch an existing entity, provide the primary key and only the fields you want to update:

```typescript
// Update only the title of an article
const patched = await session.patchGraph(Article, {
  id: articleId,
  title: 'Updated Title'
});

if (patched) {
  console.log('Title updated:', patched.title);
  // Other fields (content, published) remain unchanged
} else {
  console.log('Article not found');
}
```

### Patching Relations

`patchGraph` supports all relation types with partial update semantics:

#### HasMany Relations

For `HasMany` relations, you can:
- Update existing children by providing their IDs
- Add new children by omitting IDs
- Children not mentioned in the payload remain unchanged (unless using `pruneMissing`)

```typescript
const patched = await session.patchGraph(Author, {
  id: authorId,
  name: 'Stephen Edwin King',
  books: [
    { id: book1Id, title: 'The Shining (Revised)' },  // Update existing
    { id: book2Id, title: 'It' },                     // Update existing
    { title: 'Pet Sematary' }                         // Add new
  ]
  // Other books not in this array remain unchanged
});
```

#### HasOne Relations

For `HasOne` relations, you can update the related entity by providing its ID:

```typescript
const patched = await session.patchGraph(User, {
  id: userId,
  profile: {
    id: profileId,
    bio: 'Senior Software Engineer'
    // website field remains unchanged
  }
});
```

#### BelongsToMany Relations

For `BelongsToMany` relations, you can attach and detach entities:

```typescript
const patched = await session.patchGraph(Post, {
  id: postId,
  title: 'Advanced TypeScript Patterns',
  tags: [tag2Id, tag3Id]  // Replaces all tags with these two
});
```

### Complex Graph Patching

`patchGraph` can handle complex graphs with multiple relation types:

```typescript
const patched = await session.patchGraph(Company, {
  id: companyId,
  name: 'TechCorp International',
  headquarters: {
    id: hqId,
    city: 'New York'
    // address field remains unchanged
  },
  employees: [
    { id: aliceId, role: 'Senior Developer', skills: [jsSkillId, tsSkillId, pySkillId] },
    { id: bobId, name: 'Robert' },
    { name: 'Charlie', role: 'Manager', skills: [pySkillId] }
  ]
});
```

### Return Value

`patchGraph` returns the patched entity instance or `null` if the entity doesn't exist:

```typescript
const result = await session.patchGraph(Article, { id: 99999, title: 'Test' });

if (result === null) {
  console.log('Article not found');
}
```

### PatchGraph Options

`patchGraph` accepts the same options as `saveGraph`:

```typescript
interface SaveGraphSessionOptions extends SaveGraphOptions {
  transactional?: boolean; // Default: true. Wraps the patch operation in a transaction.
  flush?: boolean; // Default: false. Flushes after patchGraph when not transactional.
  pruneMissing?: boolean; // Default: false. Deletes related entities not present in the payload.
  coerce?: 'json' | 'json-in'; // Optional. Coerces JSON-friendly values for date-like columns.
}
```

### Error Handling

`patchGraph` throws an error if the primary key is not provided:

```typescript
// This will throw: "patchGraph requires a primary key value for 'id'"
await session.patchGraph(Article, { title: 'Test' });
```

### Multi-Dialect Support

`patchGraph` works consistently across all supported dialects (SQLite, MySQL, PostgreSQL, SQL Server):

```typescript
// Works the same way regardless of the database dialect
const patched = await session.patchGraph(Article, {
  id: articleId,
  title: 'Updated Title'
});
```
