import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq, gt } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import type { TableDef } from '../../src/schema/table.js';
import type { OrmSession } from '../../src/orm/orm-session.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { sel } from '../../src/query-builder/select-helpers.js';
import {
  closeDb,
  createSqliteSessionFromDb
} from './sqlite-helpers.ts';

@Entity()
class Author {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @HasMany({ target: () => Book, foreignKey: 'authorId' })
  books!: HasManyCollection<Book>;
}

@Entity()
class Book {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.notNull(col.int()))
  authorId!: number;

  @BelongsTo({ target: () => Author, foreignKey: 'authorId' })
  author!: Author;
}

describe('high-level decorators + select query e2e (sqlite)', () => {
  let db: sqlite3.Database;
  let session: OrmSession;
  let authorTable: TableDef;
  let bookTable: TableDef;
  let tables: TableDef[];

  const run = (sql: string, params: unknown[] = []): Promise<void> =>
    new Promise((resolve, reject) => {
      db.run(sql, params, err => (err ? reject(err) : resolve()));
    });

  const seedData = async (): Promise<void> => {
    await run('INSERT INTO authors (id, name) VALUES (?, ?)', [1, 'Alice']);
    await run('INSERT INTO authors (id, name) VALUES (?, ?)', [2, 'Bob']);

    await run('INSERT INTO books (id, title, authorId) VALUES (?, ?, ?)', [
      1,
      'Alice – First Book',
      1
    ]);
    await run('INSERT INTO books (id, title, authorId) VALUES (?, ?, ?)', [
      2,
      'Alice – Second Book',
      1
    ]);
    await run('INSERT INTO books (id, title, authorId) VALUES (?, ?, ?)', [
      3,
      'Bob – Only Book',
      2
    ]);
  };

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    tables = bootstrapEntities();
    authorTable = getTableDefFromEntity(Author)!;
    bookTable = getTableDefFromEntity(Book)!;

    await run(`
      CREATE TABLE authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    await run(`
      CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        authorId INTEGER NOT NULL
      );
    `);

    session = createSqliteSessionFromDb(db);
    await seedData();
  });

  afterAll(async () => {
    await closeDb(db);
  });

  it('bootstraps entity metadata into table definitions', () => {
    expect(authorTable).toBeDefined();
    expect(bookTable).toBeDefined();
    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'authors' }),
        expect.objectContaining({ name: 'books' })
      ])
    );

    expect(authorTable.name).toBe('authors');
    expect(bookTable.name).toBe('books');

    expect(Object.keys(authorTable.columns)).toEqual(
      expect.arrayContaining(['id', 'name'])
    );
    expect(Object.keys(bookTable.columns)).toEqual(
      expect.arrayContaining(['id', 'title', 'authorId'])
    );

    expect(authorTable.relations).toHaveProperty('books');
    expect(bookTable.relations).toHaveProperty('author');

    const booksRel = authorTable.relations['books'] as any;
    expect(booksRel.foreignKey).toBe('authorId');
  });

  it('loads a single entity with lazy has-many relation via session.find', async () => {
    const alice = await session.find(Author, 1);

    expect(alice).toBeDefined();
    expect(alice!.name).toBe('Alice');

    const books = await (alice!.books as HasManyCollection<Book>).load();
    const titles = books.map(b => b.title).sort();

    expect(titles).toEqual(['Alice – First Book', 'Alice – Second Book'].sort());
  });

  it('builds and executes a query with selectFromEntity + where/gt/include', async () => {
    const qb = selectFromEntity(Author)
      .include('books')
      .where(gt({ table: authorTable.name, name: 'id' }, 1));

    const result = await qb.execute(session);

    expect(result).toHaveLength(1);

    const bob = result[0];
    expect(bob.name).toBe('Bob');

    const bobBooks = (bob.books as HasManyCollection<Book>).getItems().map(b => b.title);
    expect(bobBooks).toEqual(['Bob – Only Book']);
  });

  it('supports whereHas on relations with nested predicates', async () => {
    const qb = selectFromEntity(Author)
      .select(sel(authorTable, 'id', 'name'))
      .whereHas('books', childQb =>
        childQb.where(gt({ table: bookTable.name, name: 'id' }, 2))
      );

    const authors = await qb.execute(session);
    const names = authors.map(a => a.name);

    expect(names).toEqual(['Bob']);
  });

  it('allows direct use of SelectQueryBuilder with eq on columns', async () => {
    const qb = new SelectQueryBuilder(authorTable)
      .select(sel(authorTable, 'id', 'name'))
      .where(eq({ table: authorTable.name, name: 'name' }, 'Alice'));

    const authors = await qb.execute(session);
    expect(authors).toHaveLength(1);
    expect(authors[0].name).toBe('Alice');
  });
});


