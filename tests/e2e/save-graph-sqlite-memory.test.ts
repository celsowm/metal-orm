import { beforeEach, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { bootstrapEntities } from '../../src/decorators/bootstrap.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from '../../src/decorators/relations.js';
import { col } from '../../src/schema/column-types.js';
import { execSql, closeDb, createSqliteSessionFromDb } from './sqlite-helpers.ts';
import { HasManyCollection, HasOneReference, ManyToManyCollection } from '../../src/schema/types.js';

const createTables = async (db: sqlite3.Database): Promise<void> => {
  await execSql(db, `
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  await execSql(db, `
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER,
      biography TEXT
    );
  `);

  await execSql(db, `
    CREATE TABLE books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER,
      title TEXT NOT NULL
    );
  `);

  await execSql(db, `
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  await execSql(db, `
    CREATE TABLE author_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL
    );
  `);
};

const queryAll = <T extends Record<string, unknown>>(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> => {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows as T[]);
    });
  });
};

describe('saveGraph e2e (sqlite in-memory)', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('persists a nested DTO graph through sqlite in-memory', async () => {
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

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    await createTables(db);
    const session = createSqliteSessionFromDb(db);

    try {
      const payload = {
        name: 'J.K. Rowling',
        profile: { biography: 'Fantasy writer' },
        books: [
          { title: 'The Philosopher\'s Stone' },
          { title: 'Chamber of Secrets' }
        ],
        projects: [
          { name: 'Fantastic Beasts' }
        ]
      };

      const author = await session.saveGraph(Author, payload);

      expect(author.id).toBeGreaterThan(0);
      expect(author.profile.get()?.biography).toBe('Fantasy writer');

      const [profileRow] = await queryAll<{ id: number; author_id: number; biography: string }>(
        db,
        'SELECT * FROM profiles WHERE author_id = ?',
        [author.id]
      );
      expect(profileRow.biography).toBe('Fantasy writer');

      const bookRows = await queryAll<{ id: number; title: string }>(
        db,
        'SELECT * FROM books WHERE author_id = ? ORDER BY id',
        [author.id]
      );
      expect(bookRows).toHaveLength(2);
      expect(bookRows.map(book => book.title)).toEqual([
        'The Philosopher\'s Stone',
        'Chamber of Secrets'
      ]);

      const projects = await queryAll<{ id: number; name: string }>(db, 'SELECT * FROM projects');
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Fantastic Beasts');

      const pivot = await queryAll<{ author_id: number; project_id: number }>(
        db,
        'SELECT author_id, project_id FROM author_projects WHERE author_id = ?',
        [author.id]
      );
      expect(pivot).toHaveLength(1);
      expect(pivot[0].project_id).toBe(projects[0].id);

      const updatePayload = {
        id: author.id,
        name: 'J.K. Rowling',
        books: [
          { id: bookRows[0].id, title: 'The Philosopher\'s Stone (Updated)' }
        ]
      };

      await session.saveGraph(Author, updatePayload, { pruneMissing: true });

      const remainingBooks = await queryAll<{ id: number; title: string }>(
        db,
        'SELECT * FROM books WHERE author_id = ?',
        [author.id]
      );
      expect(remainingBooks).toHaveLength(1);
      expect(remainingBooks[0].title).toBe('The Philosopher\'s Stone (Updated)');
    } finally {
      await closeDb(db);
    }
  });
});




