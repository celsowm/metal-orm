import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { esel } from '../../src/query-builder/select-helpers.js';
import type { HasManyCollection } from '../../src/schema/types.js';
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
import { applyFilter } from '../../src/dto/apply-filter.js';
import type { WhereInput } from '../../src/dto/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(100))
  name!: string;

  @HasMany({ target: () => Post, foreignKey: 'userId' })
  posts!: HasManyCollection<Post>;
}

@Entity()
class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(200))
  title!: string;

  @Column(col.boolean())
  published!: boolean;

  @Column(col.int())
  userId!: number;

  @BelongsTo({ target: () => User, foreignKey: 'userId' })
  user?: User;
}

describe('decorators + applyFilter relations (sqlite)', () => {
  let db: sqlite3.Database;

  beforeEach(() => {
    db = new sqlite3.Database(':memory:');
  });

  afterEach(async () => {
    await closeDb(db);
  });

  describe('some filter', () => {
    it('filters users with at least one published post', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Draft', 0, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Guide', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [4, 'Unpublished', 0, 3]);

      const qb = selectFromEntity(User).include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          some: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Alice', 'Bob']);
    });

    it('filters users with posts containing keyword', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'React Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Vue Guide', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Angular Basics', 0, 2]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          some: { title: { contains: 'Tutorial' } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  describe('none filter', () => {
    it('filters users with no published posts', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Published', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Draft', 0, 2]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          none: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Bob', 'Charlie']);
    });

    it('filters users with no posts containing keyword', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'React Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Vue Guide', 1, 2]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          none: { title: { contains: 'Tutorial' } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });
  });

  describe('every filter', () => {
    it('filters users where all posts are published', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Post 1', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Post 2', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Post 3', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [4, 'Draft', 0, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [5, 'Unpublished', 0, 3]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          every: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  describe('isEmpty filter', () => {
    it('filters users with no posts', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Post 1', 1, 1]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          isEmpty: true
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Bob', 'Charlie']);
    });

    it('filters users with at least one post', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Post 1', 1, 1]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          isEmpty: false
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  describe('combined filters', () => {
    it('filters users by name and posts relation', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice Tutorial']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Alice Guide']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'React', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Vue', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Angular', 0, 3]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        name: { contains: 'Alice' },
        posts: {
          some: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Alice Guide', 'Alice Tutorial']);
    });

    it('filters users with multiple relation filters', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Guide', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Spam', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [4, 'Ads', 1, 2]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .include('posts');

      const where: WhereInput<typeof User> = {
        posts: {
          some: { title: { contains: 'Tutorial' } },
          none: { title: { contains: 'Spam' } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });
  });

  describe('with includePick', () => {
    it('filters users with some posts and picks specific columns', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'React Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Vue Guide', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Angular Basics', 0, 2]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .includePick('posts', ['id', 'title']);

      const where: WhereInput<typeof User> = {
        posts: {
          some: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');

      const posts = users[0].posts.getItems();
      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBeDefined();
      expect((posts[0] as any).published).toBeUndefined();
    });

    it('filters users with none posts using includePick', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Tutorial', 1, 1]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .includePick('posts', ['id', 'title']);

      const where: WhereInput<typeof User> = {
        posts: {
          isEmpty: true
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Bob', 'Charlie']);
    });

    it('filters with combined column and relation filters using includePick', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice Developer']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bob Designer']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Charlie Manager']);

      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'React Tutorial', 1, 1]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Vue Guide', 1, 2]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Angular Basics', 0, 3]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .includePick('posts', ['id', 'title']);

      const where: WhereInput<typeof User> = {
        name: { contains: 'Developer' },
        posts: {
          some: { published: { equals: true } }
        }
      };

      const users = await applyFilter(qb, User, where).execute(session);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice Developer');
    });

    it('filters users starting with B and posts containing T', async () => {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Alice']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [2, 'Bruno']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [3, 'Bob']);
      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [4, 'Bianca']);

      // Alice matches post filter but not name filter
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [1, 'Testing Guide', 1, 1]);
      // Bruno matches name filter but not post filter (no "t" in title)
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [2, 'Guide', 1, 2]);
      // Bob matches both filters
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [3, 'Beginner Tips', 1, 3]);
      // Bianca matches both filters and has a non-matching extra post
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [4, 'Tutorial', 1, 4]);
      await runSql(db, 'INSERT INTO posts (id, title, published, userId) VALUES (?, ?, ?, ?);', [5, 'Guide', 1, 4]);

      const qb = selectFromEntity(User)
        .select(esel(User, 'id', 'name'))
        .includePick('posts', ['id', 'title']);

      const where: WhereInput<typeof User> = {
        name: { startsWith: 'B' },
        posts: {
          some: { title: { contains: 'T' } }
        }
      };

      const filteredQb = applyFilter(qb, User, where);
      const compiled = filteredQb.compile('sqlite');
      const normalizedSql = compiled.sql.replace(/\s+/g, ' ').trim();
      const lowerSql = normalizedSql.toLowerCase();

      expect(normalizedSql).toMatch(/select distinct/i);
      expect(normalizedSql).toMatch(/from "users"/i);
      expect(normalizedSql).toMatch(/left join "posts" on/i);
      expect(normalizedSql).toMatch(/inner join "posts" as "posts_2" on/i);
      expect(normalizedSql).toMatch(/"posts"\."userId"\s*=\s*"users"\."id"/);
      expect(normalizedSql).toMatch(/"posts_2"\."userId"\s*=\s*"users"\."id"/);
      // The includePick LEFT JOIN owns the "posts" alias; the filter LIKE is applied on that alias.
      expect(normalizedSql).toMatch(/"posts"\."title"\s+like\s+\?/i);
      expect(normalizedSql).toMatch(/where\s+"users"\."name"\s+like\s+\?/i);

      const leftJoinIndex = lowerSql.indexOf('left join "posts"');
      const innerJoinIndex = lowerSql.indexOf('inner join "posts" as "posts_2"');
      expect(leftJoinIndex).toBeGreaterThan(-1);
      expect(innerJoinIndex).toBeGreaterThan(-1);
      expect(leftJoinIndex).toBeLessThan(innerJoinIndex);

      expect(compiled.params).toEqual(['%T%', 'B%']);

      const users = await filteredQb.execute(session);

      expect(users).toHaveLength(2);
      const names = users.map(u => u.name).sort();
      expect(names).toEqual(['Bianca', 'Bob']);

      for (const user of users) {
        expect(user.name.startsWith('B')).toBe(true);
        const posts = user.posts.getItems();
        const hasMatchingTitle = posts.some(post => post.title.toLowerCase().includes('t'));
        expect(hasMatchingTitle).toBe(true);
      }
    });
  });
});
