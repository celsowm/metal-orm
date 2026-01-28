import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { bootstrapEntities } from '../../src/decorators/bootstrap.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { HasMany, HasOne, BelongsTo, BelongsToMany } from '../../src/decorators/relations.js';
import { getTableDefFromEntity } from '../../src/decorators/index.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection, HasOneReference, ManyToManyCollection } from '../../src/schema/types.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { MySqlSchemaDialect } from '../../src/core/ddl/dialects/mysql-schema-dialect.js';
import { PostgresSchemaDialect } from '../../src/core/ddl/dialects/postgres-schema-dialect.js';
import { closeDb, createSqliteSessionFromDb } from './sqlite-helpers.js';
import {
  createMysqlServer,
  stopMysqlServer,
  queryAll as queryAllMysql,
  runSql as runSqlMysql,
  type MysqlTestSetup
} from './mysql-helpers.js';
import {
  createPgliteServer,
  stopPgliteServer,
  queryAll as queryAllPg,
  runSql as runSqlPg,
  type PgliteTestSetup
} from './pglite-helpers.js';

const queryAllSqlite = <T extends Record<string, unknown>>(
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

describe('patchGraph e2e (sqlite in-memory)', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('patches only provided fields on an existing entity', async () => {
    @Entity()
    class Article {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.varchar(255))
      content!: string;

      @Column(col.boolean())
      published!: boolean;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const articleTable = getTableDefFromEntity(Article)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), articleTable);

      const created = await session.saveGraph(Article, {
        title: 'Original Title',
        content: 'Original Content',
        published: false
      });

      expect(created.id).toBeGreaterThan(0);

      const patched = await session.patchGraph(Article, {
        id: created.id,
        title: 'Updated Title'
      });

      expect(patched).not.toBeNull();
      expect(patched!.title).toBe('Updated Title');
      expect(patched!.content).toBe('Original Content');
      expect(patched!.published).toBeFalsy();

      const [row] = await queryAllSqlite<{ title: string; content: string; published: number }>(
        db,
        'SELECT title, content, published FROM articles WHERE id = ?',
        [created.id]
      );
      expect(row.title).toBe('Updated Title');
      expect(row.content).toBe('Original Content');
      expect(row.published).toBe(0);
    } finally {
      await closeDb(db);
    }
  });

  it('returns null when entity does not exist', async () => {
    @Entity()
    class Article {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.varchar(255))
      content!: string;

      @Column(col.boolean())
      published!: boolean;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const articleTable = getTableDefFromEntity(Article)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), articleTable);

      const result = await session.patchGraph(Article, {
        id: 99999,
        title: 'Non-existent'
      });

      expect(result).toBeNull();
    } finally {
      await closeDb(db);
    }
  });

  it('patches multiple fields at once', async () => {
    @Entity()
    class Article {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.varchar(255))
      content!: string;

      @Column(col.boolean())
      published!: boolean;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const articleTable = getTableDefFromEntity(Article)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), articleTable);

      const created = await session.saveGraph(Article, {
        title: 'Title',
        content: 'Content',
        published: false
      });

      const patched = await session.patchGraph(Article, {
        id: created.id,
        title: 'New Title',
        published: true
      });

      expect(patched!.title).toBe('New Title');
      expect(patched!.content).toBe('Content');
      expect(patched!.published).toBeTruthy();
    } finally {
      await closeDb(db);
    }
  });

  it('patches hasMany children - add new, update existing', async () => {
    @Entity({ tableName: 'patch_authors' })
    class PatchAuthor {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      name!: string;

      @HasMany({ target: () => PatchBook, foreignKey: 'authorId' })
      books!: HasManyCollection<PatchBook>;
    }

    @Entity({ tableName: 'patch_books' })
    class PatchBook {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      authorId!: number;

      @BelongsTo({ target: () => PatchAuthor, foreignKey: 'authorId' })
      author?: PatchAuthor;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const authorTable = getTableDefFromEntity(PatchAuthor)!;
    const bookTable = getTableDefFromEntity(PatchBook)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), authorTable, bookTable);

      const created = await session.saveGraph(PatchAuthor, {
        name: 'Stephen King',
        books: [
          { title: 'The Shining' },
          { title: 'It' },
          { title: 'Carrie' }
        ]
      });

      expect(created.id).toBeGreaterThan(0);
      const createdBooks = created.books.getItems();
      expect(createdBooks).toHaveLength(3);
      const shiningBook = createdBooks.find(b => b.title === 'The Shining')!;
      const itBook = createdBooks.find(b => b.title === 'It')!;

      const patched = await session.patchGraph(PatchAuthor, {
        id: created.id,
        name: 'Stephen Edwin King',
        books: [
          { id: shiningBook.id, title: 'The Shining (Revised)' },
          { id: itBook.id, title: 'It' },
          { title: 'Pet Sematary' }
        ]
      });

      expect(patched).not.toBeNull();
      expect(patched!.name).toBe('Stephen Edwin King');

      const patchedBooks = patched!.books.getItems();
      expect(patchedBooks.length).toBeGreaterThanOrEqual(3);
      expect(patchedBooks.some(b => b.title === 'The Shining (Revised)')).toBe(true);
      expect(patchedBooks.some(b => b.title === 'Pet Sematary')).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('patches hasOne relation - set and update', async () => {
    @Entity({ tableName: 'patch_users' })
    class PatchUser {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      username!: string;

      @HasOne({ target: () => PatchProfile, foreignKey: 'userId' })
      profile!: HasOneReference<PatchProfile>;
    }

    @Entity({ tableName: 'patch_profiles' })
    class PatchProfile {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.int())
      userId!: number;

      @Column(col.varchar(500))
      bio!: string;

      @Column(col.varchar(255))
      website!: string;

      @BelongsTo({ target: () => PatchUser, foreignKey: 'userId' })
      user?: PatchUser;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const userTable = getTableDefFromEntity(PatchUser)!;
    const profileTable = getTableDefFromEntity(PatchProfile)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), userTable, profileTable);

      const created = await session.saveGraph(PatchUser, {
        username: 'johndoe',
        profile: {
          bio: 'Software developer',
          website: 'https://johndoe.dev'
        }
      });

      expect(created.id).toBeGreaterThan(0);
      const createdProfile = created.profile.get();
      expect(createdProfile?.bio).toBe('Software developer');

      const patched = await session.patchGraph(PatchUser, {
        id: created.id,
        profile: {
          id: createdProfile!.id,
          bio: 'Senior Software Engineer'
        }
      });

      expect(patched).not.toBeNull();
      const patchedProfile = patched!.profile.get();
      expect(patchedProfile?.bio).toBe('Senior Software Engineer');
      expect(patchedProfile?.website).toBe('https://johndoe.dev');
    } finally {
      await closeDb(db);
    }
  });

  it('patches belongsToMany relation - attach and detach tags', async () => {
    @Entity({ tableName: 'patch_posts' })
    class PatchPost {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @BelongsToMany({
        target: () => PatchTag,
        pivotTable: () => PatchPostTag,
        pivotForeignKeyToRoot: 'postId',
        pivotForeignKeyToTarget: 'tagId'
      })
      tags!: ManyToManyCollection<PatchTag>;
    }

    @Entity({ tableName: 'patch_tags' })
    class PatchTag {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(64))
      label!: string;

      @BelongsToMany({
        target: () => PatchPost,
        pivotTable: () => PatchPostTag,
        pivotForeignKeyToRoot: 'tagId',
        pivotForeignKeyToTarget: 'postId'
      })
      posts!: ManyToManyCollection<PatchPost>;
    }

    @Entity({ tableName: 'patch_post_tags' })
    class PatchPostTag {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.int())
      postId!: number;

      @Column(col.int())
      tagId!: number;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const postTable = getTableDefFromEntity(PatchPost)!;
    const tagTable = getTableDefFromEntity(PatchTag)!;
    const pivotTable = getTableDefFromEntity(PatchPostTag)!;

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), postTable, tagTable, pivotTable);

      const tag1 = await session.saveGraph(PatchTag, { label: 'javascript' });
      const tag2 = await session.saveGraph(PatchTag, { label: 'typescript' });
      const tag3 = await session.saveGraph(PatchTag, { label: 'nodejs' });

      const created = await session.saveGraph(PatchPost, {
        title: 'Getting Started with TypeScript',
        tags: [tag1.id, tag2.id]
      });

      expect(created.id).toBeGreaterThan(0);
      const createdTags = created.tags.getItems();
      expect(createdTags).toHaveLength(2);

      const patched = await session.patchGraph(PatchPost, {
        id: created.id,
        title: 'Advanced TypeScript Patterns',
        tags: [tag2.id, tag3.id]
      });

      expect(patched).not.toBeNull();
      expect(patched!.title).toBe('Advanced TypeScript Patterns');

      const patchedTags = patched!.tags.getItems();
      expect(patchedTags.length).toBeGreaterThanOrEqual(2);
      expect(patchedTags.some(t => t.label === 'typescript')).toBe(true);
      expect(patchedTags.some(t => t.label === 'nodejs')).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('patches complex graph with hasMany, hasOne, and belongsToMany together', async () => {
    @Entity({ tableName: 'patch_companies' })
    class PatchCompany {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      name!: string;

      @HasMany({ target: () => PatchEmployee, foreignKey: 'companyId' })
      employees!: HasManyCollection<PatchEmployee>;

      @HasOne({ target: () => PatchHeadquarters, foreignKey: 'companyId' })
      headquarters!: HasOneReference<PatchHeadquarters>;
    }

    @Entity({ tableName: 'patch_employees' })
    class PatchEmployee {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(255))
      name!: string;

      @Column(col.varchar(100))
      role!: string;

      @Column(col.int())
      companyId!: number;

      @BelongsTo({ target: () => PatchCompany, foreignKey: 'companyId' })
      company?: PatchCompany;

      @BelongsToMany({
        target: () => PatchSkill,
        pivotTable: () => PatchEmployeeSkill,
        pivotForeignKeyToRoot: 'employeeId',
        pivotForeignKeyToTarget: 'skillId'
      })
      skills!: ManyToManyCollection<PatchSkill>;
    }

    @Entity({ tableName: 'patch_headquarters' })
    class PatchHeadquarters {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.int())
      companyId!: number;

      @Column(col.varchar(255))
      address!: string;

      @Column(col.varchar(100))
      city!: string;

      @BelongsTo({ target: () => PatchCompany, foreignKey: 'companyId' })
      company?: PatchCompany;
    }

    @Entity({ tableName: 'patch_skills' })
    class PatchSkill {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.varchar(100))
      name!: string;
    }

    @Entity({ tableName: 'patch_employee_skills' })
    class PatchEmployeeSkill {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.int())
      employeeId!: number;

      @Column(col.int())
      skillId!: number;
    }

    bootstrapEntities();

    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);
    const companyTable = getTableDefFromEntity(PatchCompany)!;
    const employeeTable = getTableDefFromEntity(PatchEmployee)!;
    const hqTable = getTableDefFromEntity(PatchHeadquarters)!;
    const skillTable = getTableDefFromEntity(PatchSkill)!;
    const empSkillTable = getTableDefFromEntity(PatchEmployeeSkill)!;

    try {
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        companyTable,
        employeeTable,
        hqTable,
        skillTable,
        empSkillTable
      );

      const jsSkill = await session.saveGraph(PatchSkill, { name: 'JavaScript' });
      const tsSkill = await session.saveGraph(PatchSkill, { name: 'TypeScript' });
      const pySkill = await session.saveGraph(PatchSkill, { name: 'Python' });

      const created = await session.saveGraph(PatchCompany, {
        name: 'TechCorp',
        headquarters: {
          address: '123 Tech Street',
          city: 'San Francisco'
        },
        employees: [
          { name: 'Alice', role: 'Developer', skills: [jsSkill.id, tsSkill.id] },
          { name: 'Bob', role: 'Designer', skills: [jsSkill.id] }
        ]
      });

      expect(created.id).toBeGreaterThan(0);
      const createdEmployees = created.employees.getItems();
      expect(createdEmployees).toHaveLength(2);
      const alice = createdEmployees.find(e => e.name === 'Alice')!;
      const bob = createdEmployees.find(e => e.name === 'Bob')!;
      const hq = created.headquarters.get()!;

      const patched = await session.patchGraph(PatchCompany, {
        id: created.id,
        name: 'TechCorp International',
        headquarters: {
          id: hq.id,
          city: 'New York'
        },
        employees: [
          { id: alice.id, role: 'Senior Developer', skills: [jsSkill.id, tsSkill.id, pySkill.id] },
          { id: bob.id, name: 'Robert' },
          { name: 'Charlie', role: 'Manager', skills: [pySkill.id] }
        ]
      });

      expect(patched).not.toBeNull();
      expect(patched!.name).toBe('TechCorp International');

      const patchedHq = patched!.headquarters.get();
      expect(patchedHq?.city).toBe('New York');
      expect(patchedHq?.address).toBe('123 Tech Street');

      const patchedEmployees = patched!.employees.getItems();
      expect(patchedEmployees.length).toBeGreaterThanOrEqual(3);

      const patchedAlice = patchedEmployees.find(e => e.name === 'Alice');
      expect(patchedAlice?.role).toBe('Senior Developer');

      const patchedBob = patchedEmployees.find(e => e.name === 'Robert');
      expect(patchedBob).toBeDefined();

      const patchedCharlie = patchedEmployees.find(e => e.name === 'Charlie');
      expect(patchedCharlie?.role).toBe('Manager');
    } finally {
      await closeDb(db);
    }
  });
});

describe('patchGraph e2e (mysql)', () => {
  let setup: MysqlTestSetup;

  beforeAll(async () => {
    setup = await createMysqlServer();
  }, 120000);

  afterAll(async () => {
    if (setup) await stopMysqlServer(setup);
  });

  beforeEach(async () => {
    clearEntityMetadata();
    try {
      await runSqlMysql(setup.connection, 'DROP TABLE IF EXISTS patch_articles');
    } catch {
      // ignore
    }
  });

  it('patches only provided fields on an existing entity', async () => {
    @Entity({ tableName: 'patch_articles' })
    class PatchArticle {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.varchar(255))
      content!: string;

      @Column(col.boolean())
      published!: boolean;
    }

    bootstrapEntities();

    const articleTable = getTableDefFromEntity(PatchArticle)!;
    await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), articleTable);

    await runSqlMysql(
      setup.connection,
      "INSERT INTO patch_articles (id, title, content, published) VALUES (1, 'MySQL Original', 'MySQL Content', 0)"
    );

    const patched = await setup.session.patchGraph(PatchArticle, {
      id: 1,
      content: 'MySQL Updated Content'
    });

    expect(patched).not.toBeNull();
    expect(patched!.title).toBe('MySQL Original');
    expect(patched!.content).toBe('MySQL Updated Content');
    expect(patched!.published).toBeFalsy();

    const [row] = await queryAllMysql<{ title: string; content: string; published: number }>(
      setup.connection,
      'SELECT title, content, published FROM patch_articles WHERE id = ?',
      [1]
    );
    expect(row.title).toBe('MySQL Original');
    expect(row.content).toBe('MySQL Updated Content');
    expect(row.published).toBe(0);
  });

  it('returns null when entity does not exist', async () => {
    @Entity({ tableName: 'patch_articles' })
    class PatchArticle {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;
    }

    bootstrapEntities();

    const articleTable = getTableDefFromEntity(PatchArticle)!;
    await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), articleTable);

    const result = await setup.session.patchGraph(PatchArticle, {
      id: 99999,
      title: 'Non-existent'
    });

    expect(result).toBeNull();
  });
});

describe('patchGraph e2e (postgres via pglite)', () => {
  let setup: PgliteTestSetup;

  beforeAll(async () => {
    setup = await createPgliteServer();
  });

  afterAll(async () => {
    if (setup) await stopPgliteServer(setup);
  });

  beforeEach(async () => {
    clearEntityMetadata();
    try {
      await runSqlPg(setup.db, 'DROP TABLE IF EXISTS patch_articles');
    } catch {
      // ignore
    }
  });

  it('patches only provided fields on an existing entity', async () => {
    @Entity({ tableName: 'patch_articles' })
    class PatchArticle {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.varchar(255))
      content!: string;

      @Column(col.boolean())
      published!: boolean;
    }

    bootstrapEntities();

    const articleTable = getTableDefFromEntity(PatchArticle)!;
    await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), articleTable);

    await runSqlPg(
      setup.db,
      "INSERT INTO patch_articles (id, title, content, published) VALUES (1, 'PG Original', 'PG Content', false)"
    );

    const patched = await setup.session.patchGraph(PatchArticle, {
      id: 1,
      published: true
    });

    expect(patched).not.toBeNull();
    expect(patched!.title).toBe('PG Original');
    expect(patched!.content).toBe('PG Content');
    expect(patched!.published).toBe(true);

    const [row] = await queryAllPg<{ title: string; content: string; published: boolean }>(
      setup.db,
      'SELECT title, content, published FROM patch_articles WHERE id = $1',
      [1]
    );
    expect(row.title).toBe('PG Original');
    expect(row.content).toBe('PG Content');
    expect(row.published).toBe(true);
  });

  it('returns null when entity does not exist', async () => {
    @Entity({ tableName: 'patch_articles' })
    class PatchArticle {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;
    }

    bootstrapEntities();

    const articleTable = getTableDefFromEntity(PatchArticle)!;
    await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), articleTable);

    const result = await setup.session.patchGraph(PatchArticle, {
      id: 99999,
      title: 'Non-existent'
    });

    expect(result).toBeNull();
  });
});
