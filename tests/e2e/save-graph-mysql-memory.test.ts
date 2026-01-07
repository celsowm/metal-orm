import { beforeEach, describe, expect, it } from 'vitest';

import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { bootstrapEntities } from '../../src/decorators/bootstrap.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from '../../src/decorators/relations.js';
import { getTableDefFromEntity } from '../../src/decorators/index.js';
import { col } from '../../src/schema/column-types.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { MySqlSchemaDialect } from '../../src/core/ddl/dialects/mysql-schema-dialect.js';
import {
  stopMysqlServer,
  createMysqlServer,
  queryAll
} from './mysql-helpers.ts';
import { HasManyCollection, HasOneReference, ManyToManyCollection } from '../../src/schema/types.js';

describe('saveGraph e2e (mysql-memory-server)', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('persists a nested DTO graph through mysql-memory-server', async () => {
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

    const setup = await createMysqlServer();
    const authorTable = getTableDefFromEntity(Author)!;
    const profileTable = getTableDefFromEntity(Profile)!;
    const bookTable = getTableDefFromEntity(Book)!;
    const projectTable = getTableDefFromEntity(Project)!;
    const authorProjectTable = getTableDefFromEntity(AuthorProject)!;

    await executeSchemaSqlFor(
      setup.session.executor,
      new MySqlSchemaDialect(),
      authorTable,
      profileTable,
      bookTable,
      projectTable,
      authorProjectTable
    );

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

      const author = await setup.session.saveGraph(Author, payload);

      expect(author.id).toBeGreaterThan(0);
      expect(author.profile.get()?.biography).toBe('Fantasy writer');

      const [profileRow] = await queryAll<{ id: number; author_id: number; biography: string }>(
        setup.connection,
        'SELECT * FROM profiles WHERE author_id = ?',
        [author.id]
      );
      expect(profileRow.biography).toBe('Fantasy writer');

      const bookRows = await queryAll<{ id: number; title: string }>(
        setup.connection,
        'SELECT * FROM books WHERE author_id = ? ORDER BY id',
        [author.id]
      );
      expect(bookRows).toHaveLength(2);
      expect(bookRows.map(book => book.title)).toEqual([
        'The Philosopher\'s Stone',
        'Chamber of Secrets'
      ]);

      const projects = await queryAll<{ id: number; name: string }>(setup.connection, 'SELECT * FROM projects');
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Fantastic Beasts');

      const pivot = await queryAll<{ author_id: number; project_id: number }>(
        setup.connection,
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

      await setup.session.saveGraph(Author, updatePayload, { pruneMissing: true });

      const remainingBooks = await queryAll<{ id: number; title: string }>(
        setup.connection,
        'SELECT * FROM books WHERE author_id = ?',
        [author.id]
      );
      expect(remainingBooks).toHaveLength(1);
      expect(remainingBooks[0].title).toBe('The Philosopher\'s Stone (Updated)');
    } finally {
      await stopMysqlServer(setup);
    }
  });
});
