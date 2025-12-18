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

`session.saveGraph` accepts an optional `SaveGraphOptions` object:

```typescript
interface SaveGraphOptions {
  transactional?: boolean; // Default: true. Wraps the save operation in a transaction.
  pruneMissing?: boolean; // Default: false. Deletes related entities not present in the payload.
  coerce?: 'json'; // Optional. Coerces JSON-friendly values (e.g., Date -> ISO string for DATETIME-like columns).
}
```

- `transactional`: If `true`, the entire `saveGraph` operation will be wrapped in a database transaction, ensuring atomicity. If any part of the save fails, all changes are rolled back.
- `pruneMissing`: When `true`, for `HasMany` and `BelongsToMany` relations, any related entities that exist in the database but are not included in the payload will be deleted. Use with caution, as this can lead to data loss if not intended.
- `coerce: 'json'`: Currently converts `Date` values in the payload into ISO strings for DATE/DATETIME/TIMESTAMP/TIMESTAMPTZ columns.
