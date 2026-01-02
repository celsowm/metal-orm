import { beforeEach, describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { DbExecutor } from '../../src/core/execution/db-executor.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection, HasOneReference, ManyToManyCollection } from '../../src/schema/types.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { bootstrapEntities } from '../../src/decorators/bootstrap.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from '../../src/decorators/relations.js';

type QueryLogEntry = { sql: string; params?: unknown[] };

const createSessionWithSpy = () => {
  const log: QueryLogEntry[] = [];
  const nextIds = new Map<string, number>();

  const executor: DbExecutor = {
    capabilities: { transactions: true },
    async executeSql(sql: string, params?: unknown[]) {
      log.push({ sql, params });
      const match = sql.match(/INSERT INTO\s+"?([^\s"()]+)"?/i);
      if (match) {
        const table = match[1];
        const next = (nextIds.get(table) ?? 0) + 1;
        nextIds.set(table, next);
        return [{ columns: ['id'], values: [[next]] }];
      }
      return [{ columns: [], values: [] }];
    },
    beginTransaction: async () => { },
    commitTransaction: async () => { },
    rollbackTransaction: async () => { },
    dispose: async () => { },
  };

  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => { }
  };

  const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: factory });
  const session = new OrmSession({ orm, executor });
  return { session, log };
};

const setupEntities = () => {
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

    @Column(col.varchar(255))
    title!: string;

    @Column(col.int())
    author_id!: number;

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

  return { Author, Book, Profile, Project };
};

describe('OrmSession.saveGraph', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('creates root + nested relations from a payload', async () => {
    const { Author } = setupEntities();
    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    const payload = {
      name: 'J.K. Rowling',
      profile: { biography: 'Fantasy writer' },
      books: [
        { title: 'Philosopher\'s Stone' },
        { title: 'Chamber of Secrets' }
      ],
      projects: [
        1,
        { name: 'Fantastic Beasts' }
      ]
    };

    const author = await session.saveGraph(Author, payload) as any;

    expect(author.id).toBe(1);
    expect(author.name).toBe('J.K. Rowling');
    expect(author.profile.get()?.biography).toBe('Fantasy writer');

    const books = author.books.getItems();
    expect(books.map(book => book.title)).toEqual([
      'Philosopher\'s Stone',
      'Chamber of Secrets'
    ]);
    expect(books.every(book => book.author_id === author.id)).toBe(true);

    const projects = author.projects.getItems();
    expect(projects).toHaveLength(2);
    expect(projects.some(project => project.name === 'Fantastic Beasts')).toBe(true);
    expect(log.some(entry => entry.sql.includes('INSERT INTO "projects"'))).toBe(true);
    expect(log.some(entry => entry.params?.includes('Fantastic Beasts'))).toBe(true);

    expect(log.some(entry => entry.sql.includes('INSERT INTO "authors"'))).toBe(true);
    expect(log.some(entry => entry.sql.includes('INSERT INTO "books"'))).toBe(true);
    expect(log.some(entry => entry.sql.includes('INSERT INTO "profiles"'))).toBe(true);
    expect(log.some(entry => entry.sql.includes('INSERT INTO "author_projects"'))).toBe(true);
  });

  it('prunes missing children when requested', async () => {
    const { Author } = setupEntities();
    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    const initial = await session.saveGraph(Author, {
      name: 'Neil Gaiman',
      books: [
        { title: 'Coraline' },
        { title: 'American Gods' }
      ]
    }) as any;

    const [coraline] = initial.books.getItems();

    const updated = await session.saveGraph(Author, {
      id: initial.id,
      name: 'Neil Gaiman',
      books: [
        { id: coraline.id, title: 'Coraline (Updated)' }
      ]
    }, { pruneMissing: true }) as any;

    const books = updated.books.getItems();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Coraline (Updated)');
    expect(log.some(entry => entry.sql.includes('UPDATE "books"'))).toBe(true);
  });

  it('coerces Date values to ISO strings when requested', async () => {
    @Entity()
    class Event {
      @PrimaryKey(col.int())
      id!: number;

      @Column({ type: 'DATETIME' })
      occurredAt!: string;
    }

    bootstrapEntities();
    const { session } = createSessionWithSpy();

    const date = new Date('2025-01-01T00:00:00.000Z');
    const event = await session.saveGraph(Event, { occurredAt: date } as any, { coerce: 'json' }) as any;

    expect(event.occurredAt).toBe(date.toISOString());
  });

  it('parses string dates into Date objects when coerce: json-in', async () => {
    @Entity()
    class Event {
      @PrimaryKey(col.int())
      id!: number;

      @Column({ type: 'DATETIME' })
      occurredAt!: Date;
    }

    bootstrapEntities();
    const { session } = createSessionWithSpy();

    const event = await session.saveGraph(
      Event,
      { occurredAt: '2025-01-01T00:00:00.000Z' } as any,
      { coerce: 'json-in' }
    ) as any;

    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('throws on invalid string dates when coerce: json-in', async () => {
    @Entity()
    class Event {
      @PrimaryKey(col.int())
      id!: number;

      @Column({ type: 'DATETIME' })
      occurredAt!: Date;
    }

    bootstrapEntities();
    const { session } = createSessionWithSpy();

    await expect(
      session.saveGraph(Event, { occurredAt: 'not-a-date' } as any, { coerce: 'json-in' })
    ).rejects.toThrow('occurredAt');
  });

  it('flushes when requested on non-transactional saveGraph', async () => {
    @Entity()
    class Note {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;
    }

    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    await session.saveGraph(Note, { title: 'Hello' } as any, { transactional: false, flush: true });

    expect(log.some(entry => entry.sql.includes('INSERT INTO "notes"'))).toBe(true);
  });

  it('applies saveGraph defaults from withSaveGraphDefaults', async () => {
    @Entity()
    class Note {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;
    }

    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    session.withSaveGraphDefaults({ transactional: false, flush: true });
    await session.saveGraph(Note, { title: 'Default' } as any);

    expect(log.some(entry => entry.sql.includes('INSERT INTO "notes"'))).toBe(true);
  });

  it('updateGraph updates existing entities', async () => {
    const { Author } = setupEntities();
    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    const created = await session.saveGraph(Author, { name: 'Neil' } as any) as any;
    log.length = 0;

    const updated = await session.updateGraph(
      Author,
      { id: created.id, name: 'Updated' } as any,
      { transactional: false, flush: true }
    ) as any;

    expect(updated?.name).toBe('Updated');
    expect(log.some(entry => entry.sql.includes('UPDATE "authors"'))).toBe(true);
  });

  it('updateGraph returns null when the entity does not exist', async () => {
    const { Author } = setupEntities();
    bootstrapEntities();
    const { session, log } = createSessionWithSpy();

    const result = await session.updateGraph(
      Author,
      { id: 999, name: 'Missing' } as any,
      { transactional: false, flush: true }
    );

    expect(result).toBeNull();
    expect(log.some(entry => entry.sql.includes('INSERT INTO "authors"'))).toBe(false);
  });
});




