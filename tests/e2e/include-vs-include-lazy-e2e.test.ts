import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsTo,
  HasMany,
  BelongsToMany,
  bootstrapEntities,
  selectFromEntity,
  getTableDefFromEntity
} from '../../src/decorators/index.js';
import { insertInto } from '../../src/query/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import {
  closeDb,
  execSql,
  createSqliteClient
} from '../e2e/sqlite-helpers.ts';
import { Pool } from '../../src/core/execution/pooling/pool.js';
import {
  createPooledExecutorFactory,
  type PooledConnectionAdapter
} from '../../src/orm/pooled-executor-factory.js';
import { Orm } from '../../src/orm/orm.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { OrmSession } from '../../src/orm/orm-session.js';

describe('include vs include lazy e2e', () => {
  afterEach(() => {
    clearEntityMetadata();
  });

  it('compares include and includeLazy across relation types via pooled executor', async () => {
    @Entity()
    class User {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      display_name!: string;

      @Column(col.varchar(255))
      email!: string;

      @HasMany({
        target: () => Post,
        foreignKey: 'user_id'
      })
      posts!: Post[];
    }

    @Entity()
    class Post {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      user_id!: number;

      @BelongsTo({
        target: () => User,
        foreignKey: 'user_id'
      })
      user!: User;

      @BelongsToMany({
        target: () => Tag,
        pivotTable: () => PostTag,
        pivotForeignKeyToRoot: 'post_id',
        pivotForeignKeyToTarget: 'tag_id'
      })
      tags!: Tag[];
    }

    @Entity()
    class Tag {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      label!: string;
    }

    @Entity()
    class PostTag {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.int())
      post_id!: number;

      @Column(col.int())
      tag_id!: number;

      @Column(col.varchar(255))
      assigned_at!: string;
    }

    const sqlLog: string[] = [];

    const pool = new Pool<sqlite3.Database>(
      {
        create: async () => {
          const db = new sqlite3.Database(':memory:');
          return db;
        },
        destroy: async (db) => {
          await closeDb(db);
        }
      },
      { max: 1 }
    );

    const adapter: PooledConnectionAdapter<sqlite3.Database> = {
      async query(conn, sql, params) {
        sqlLog.push(sql);
        const client = createSqliteClient(conn);
        return client.all(sql, params);
      },
      async beginTransaction(conn) {
        sqlLog.push('BEGIN');
        await execSql(conn, 'BEGIN');
      },
      async commitTransaction(conn) {
        sqlLog.push('COMMIT');
        await execSql(conn, 'COMMIT');
      },
      async rollbackTransaction(conn) {
        sqlLog.push('ROLLBACK');
        await execSql(conn, 'ROLLBACK');
      }
    };

    const factory = createPooledExecutorFactory({ pool, adapter });

    const orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: factory
    });

    const session = new OrmSession({ orm, executor: factory.createExecutor() });

    const recordedSql = (entries: string[]) =>
      entries.filter((statement) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement));

    try {
      bootstrapEntities();
      const userTable = getTableDefFromEntity(User);
      const postTable = getTableDefFromEntity(Post);
      const tagTable = getTableDefFromEntity(Tag);
      const postTagTable = getTableDefFromEntity(PostTag);

      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();
      expect(tagTable).toBeDefined();
      expect(postTagTable).toBeDefined();

      await session.executor.executeSql(`
        CREATE TABLE ${userTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          display_name TEXT NOT NULL,
          email TEXT NOT NULL
        );
      `);

      await session.executor.executeSql(`
        CREATE TABLE ${postTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          user_id INTEGER NOT NULL
        );
      `);

      await session.executor.executeSql(`
        CREATE TABLE ${tagTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL
        );
      `);

      await session.executor.executeSql(`
        CREATE TABLE ${postTagTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          assigned_at TEXT NOT NULL
        );
      `);

      const executeInsert = async (builder: ReturnType<typeof insertInto>) => {
        const compiled = builder.compile(session.dialect);
        await session.executor.executeSql(compiled.sql, compiled.params);
      };

      await executeInsert(
        insertInto(User).values({
          display_name: 'Ada Lovelace',
          email: 'ada@analytical.engine'
        })
      );

      await executeInsert(
        insertInto(Post).values([
          { title: 'Analytical Engine', user_id: 1 },
          { title: 'Notes on Babbage', user_id: 1 }
        ])
      );

      await executeInsert(
        insertInto(Tag).values([
          { label: 'history' },
          { label: 'math' }
        ])
      );

      await executeInsert(
        insertInto(PostTag).values([
          { post_id: 1, tag_id: 1, assigned_at: '1843-10-01' },
          { post_id: 1, tag_id: 2, assigned_at: '1843-11-15' },
          { post_id: 2, tag_id: 2, assigned_at: '1844-02-01' }
        ])
      );

      sqlLog.length = 0;

      const lazyPosts = await selectFromEntity(Post)
        .select('id', 'title')
        .includeLazy('user', { columns: ['display_name', 'email'] })
        .execute(session);

      expect(lazyPosts).toHaveLength(2);
      lazyPosts.forEach(post => {
        expect(post.user.display_name).toBe('Ada Lovelace');
        expect(post.user.email).toBe('ada@analytical.engine');
      });

      const lazyStatements = recordedSql(sqlLog);
      const expectedLazyStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title", "posts"."user_id" AS "user_id" FROM "posts";',
        'SELECT "users"."display_name" AS "display_name", "users"."email" AS "email", "users"."id" AS "id" FROM "users" WHERE "users"."id" IN (?);'
      ];
      expect(lazyStatements).toEqual(expectedLazyStatements);

      sqlLog.length = 0;

      const eagerPosts = await selectFromEntity(Post)
        .select('id', 'title')
        .include('user', { columns: ['display_name', 'email'] })
        .execute(session);

      expect(eagerPosts).toHaveLength(2);
      eagerPosts.forEach(post => {
        expect(post.user.display_name).toBe('Ada Lovelace');
        expect(post.user.email).toBe('ada@analytical.engine');
      });

      const eagerStatements = recordedSql(sqlLog);
      const expectedEagerStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title", "posts"."user_id" AS "user_id", "users"."display_name" AS "user__display_name", "users"."email" AS "user__email", "users"."id" AS "user__id" FROM "posts" LEFT JOIN "users" ON "users"."id" = "posts"."user_id";'
      ];
      expect(eagerStatements).toEqual(expectedEagerStatements);
      expect(lazyStatements.length).toBeGreaterThan(eagerStatements.length);

      sqlLog.length = 0;

      const lazyUsers = await selectFromEntity(User)
        .select('id', 'display_name')
        .includeLazy('posts', { columns: ['title'] })
        .execute(session);

      expect(lazyUsers).toHaveLength(1);
      console.log(lazyUsers[0].posts);
      expect(lazyUsers[0].posts).toHaveLength(2);
      expect(lazyUsers[0].posts.map(post => post.title).sort()).toEqual([
        'Analytical Engine',
        'Notes on Babbage'
      ]);

      const lazyHasManyStatements = recordedSql(sqlLog);
      const expectedLazyHasManyStatements = [
        'SELECT "users"."id" AS "id", "users"."display_name" AS "display_name" FROM "users";',
        'SELECT "posts"."title" AS "title", "posts"."id" AS "id", "posts"."user_id" AS "user_id" FROM "posts" WHERE "posts"."user_id" IN (?);'
      ];
      expect(lazyHasManyStatements).toEqual(expectedLazyHasManyStatements);

      sqlLog.length = 0;

      const eagerUsers = await selectFromEntity(User)
        .select('id', 'display_name')
        .include('posts', { columns: ['title'] })
        .execute(session);

      expect(eagerUsers).toHaveLength(1);
      expect(eagerUsers[0].posts).toHaveLength(2);
      expect(eagerUsers[0].posts.map(post => post.title).sort()).toEqual([
        'Analytical Engine',
        'Notes on Babbage'
      ]);

      const eagerHasManyStatements = recordedSql(sqlLog);
      const expectedEagerHasManyStatements = [
        'SELECT "users"."id" AS "id", "users"."display_name" AS "display_name", "posts"."title" AS "posts__title", "posts"."id" AS "posts__id" FROM "users" LEFT JOIN "posts" ON "posts"."user_id" = "users"."id";'
      ];
      expect(eagerHasManyStatements).toEqual(expectedEagerHasManyStatements);
      expect(lazyHasManyStatements.length).toBeGreaterThan(eagerHasManyStatements.length);

      sqlLog.length = 0;

      const lazyTaggedPosts = await selectFromEntity(Post)
        .select('id', 'title')
        .includeLazy('tags', {
          columns: ['label'],
          pivot: { columns: ['assigned_at'] }
        })
        .execute(session);

      const analyticalPost = lazyTaggedPosts.find(post => post.title === 'Analytical Engine');
      const mathPost = lazyTaggedPosts.find(post => post.title === 'Notes on Babbage');
      expect(analyticalPost).toBeDefined();
      expect(mathPost).toBeDefined();
      expect(analyticalPost!.tags.map(tag => tag.label).sort()).toEqual(['history', 'math']);
      expect(mathPost!.tags.map(tag => tag.label)).toEqual(['math']);
      expect(
        analyticalPost!.tags.find(tag => tag.label === 'history')?._pivot.assigned_at
      ).toBe('1843-10-01');

      const lazyManyStatements = recordedSql(sqlLog);
      const expectedLazyManyStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title" FROM "posts";',
        'SELECT "post_tags"."assigned_at" AS "assigned_at", "post_tags"."post_id" AS "post_id", "post_tags"."tag_id" AS "tag_id" FROM "post_tags" WHERE "post_tags"."post_id" IN (?, ?);',
        'SELECT "tags"."label" AS "label", "tags"."id" AS "id" FROM "tags" WHERE "tags"."id" IN (?, ?);'
      ];
      expect(lazyManyStatements).toEqual(expectedLazyManyStatements);

      sqlLog.length = 0;

      const eagerTaggedPosts = await selectFromEntity(Post)
        .select('id', 'title')
        .include('tags', {
          columns: ['label'],
          pivot: { columns: ['assigned_at'] }
        })
        .execute(session);

      const eagerAnalyticalPost = eagerTaggedPosts.find(post => post.title === 'Analytical Engine');
      const eagerMathPost = eagerTaggedPosts.find(post => post.title === 'Notes on Babbage');
      expect(eagerAnalyticalPost).toBeDefined();
      expect(eagerMathPost).toBeDefined();
      expect(eagerAnalyticalPost!.tags.map(tag => tag.label).sort()).toEqual(['history', 'math']);
      expect(eagerMathPost!.tags.map(tag => tag.label)).toEqual(['math']);

      const eagerManyStatements = recordedSql(sqlLog);
      const expectedEagerManyStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title", "tags"."label" AS "tags__label", "tags"."id" AS "tags__id", "post_tags"."assigned_at" AS "tags_pivot__assigned_at" FROM "posts" LEFT JOIN "post_tags" ON "post_tags"."post_id" = "posts"."id" LEFT JOIN "tags" ON "tags"."id" = "post_tags"."tag_id";'
      ];
      expect(eagerManyStatements).toEqual(expectedEagerManyStatements);
      expect(lazyManyStatements.length).toBeGreaterThan(eagerManyStatements.length);
    } finally {
      await factory.dispose();
    }
  });
});
