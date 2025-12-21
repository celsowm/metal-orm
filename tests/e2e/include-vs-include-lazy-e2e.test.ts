import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import type { HasManyCollection, ManyToManyCollection } from '../../src/schema/types.js';
import { col } from '../../src/schema/column-types.js';
import { eq } from '../../src/core/ast/expression.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsTo,
  HasMany,
  BelongsToMany,
  bootstrapEntities,
  selectFromEntity,
  getTableDefFromEntity,
  entityRef
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
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';

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
        target: () => Post
      })
      posts!: HasManyCollection<Post>;
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
        target: () => User
      })
      user!: User;

      @BelongsToMany({
        target: () => Tag,
        pivotTable: () => PostTag
      })
      tags!: ManyToManyCollection<Tag, PostTag>;
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
      const userRef = entityRef(User);
      const postRef = entityRef(Post);
      const tagRef = entityRef(Tag);

      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();
      expect(tagTable).toBeDefined();
      expect(postTagTable).toBeDefined();

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable!,
        postTable!,
        tagTable!,
        postTagTable!
      );

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
          { label: 'math' },
          { label: 'science' }
        ])
      );

      await executeInsert(
        insertInto(PostTag).values([
          { post_id: 1, tag_id: 1, assigned_at: '1843-10-01' },
          { post_id: 1, tag_id: 2, assigned_at: '1843-11-15' },
          { post_id: 2, tag_id: 2, assigned_at: '1844-02-01' },
          { post_id: 1, tag_id: 3, assigned_at: '1844-07-04' }
        ])
      );

      session.unitOfWork.reset();
      session.relationChanges.reset();
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
      expect(analyticalPost!.tags.map(tag => tag.label).sort()).toEqual(['history', 'math', 'science']);
      expect(mathPost!.tags.map(tag => tag.label)).toEqual(['math']);
      expect(
        analyticalPost!.tags.find(tag => tag.label === 'history')?._pivot.assigned_at
      ).toBe('1843-10-01');

      const lazyManyStatements = recordedSql(sqlLog);
      const expectedLazyManyStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title" FROM "posts";',
        'SELECT "post_tags"."assigned_at" AS "assigned_at", "post_tags"."post_id" AS "post_id", "post_tags"."tag_id" AS "tag_id" FROM "post_tags" WHERE "post_tags"."post_id" IN (?, ?);',
        'SELECT "tags"."label" AS "label", "tags"."id" AS "id" FROM "tags" WHERE "tags"."id" IN (?, ?, ?);'
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
      expect(eagerAnalyticalPost!.tags.map(tag => tag.label).sort()).toEqual(['history', 'math', 'science']);
      expect(eagerMathPost!.tags.map(tag => tag.label)).toEqual(['math']);

      const eagerManyStatements = recordedSql(sqlLog);
      const expectedEagerManyStatements = [
        'SELECT "posts"."id" AS "id", "posts"."title" AS "title", "tags"."label" AS "tags__label", "tags"."id" AS "tags__id", "post_tags"."assigned_at" AS "tags_pivot__assigned_at" FROM "posts" LEFT JOIN "post_tags" ON "post_tags"."post_id" = "posts"."id" LEFT JOIN "tags" ON "tags"."id" = "post_tags"."tag_id";'
      ];
      expect(eagerManyStatements).toEqual(expectedEagerManyStatements);
      expect(lazyManyStatements.length).toBeGreaterThan(eagerManyStatements.length);

      const allManyStatements = [...lazyManyStatements, ...eagerManyStatements];
      const expectedAllManyStatements = [
        ...expectedLazyManyStatements,
        ...expectedEagerManyStatements
      ];
      expect(allManyStatements).toEqual(expectedAllManyStatements);

      sqlLog.length = 0;

      const filteredUsers = await selectFromEntity(User)
        .select('id', 'display_name')
        .include('posts', {
          columns: ['title'],
          filter: eq(postRef.title, 'Analytical Engine')
        })
        .execute(session);

      const filteredStatements = recordedSql(sqlLog);
      const filteredTitles = filteredUsers[0].posts.map(post => post.title);

      expect(filteredUsers).toHaveLength(1);
      expect(filteredTitles).toContain('Analytical Engine');

      const expectedFilteredStatements = [
        'WITH "posts__filtered" AS (SELECT "posts"."id", "posts"."title", "posts"."user_id" FROM "posts" WHERE "posts"."title" = ?) SELECT "users"."id" AS "id", "users"."display_name" AS "display_name", "posts"."title" AS "posts__title", "posts"."id" AS "posts__id" FROM "users" LEFT JOIN "posts__filtered" AS "posts" ON "posts"."user_id" = "users"."id";'
      ];
      expect(filteredStatements).toEqual(expectedFilteredStatements);

      sqlLog.length = 0;

      session.unitOfWork.reset();
      session.relationChanges.reset();

      const filteredTaggedPosts = await selectFromEntity(Post)
        .select('id', 'title')
        .include('tags', {
          columns: ['label'],
          pivot: { columns: ['assigned_at'] },
          filter: eq(tagRef.label, 'history')
        })
        .where(eq(postRef.title, 'Analytical Engine'))
        .execute(session);

      expect(filteredTaggedPosts).toHaveLength(1);
      const historyPost = filteredTaggedPosts.find(post => post.title === 'Analytical Engine');
      expect(historyPost).toBeDefined();
      expect(historyPost!.tags.map(tag => tag.label)).toEqual(['history']);
      const filteredMathPost = filteredTaggedPosts.find(post => post.title === 'Notes on Babbage');
      expect(filteredMathPost).toBeUndefined();

      const filteredTaggedStatements = recordedSql(sqlLog);
      const expectedFilteredTaggedStatements = [
        'WITH "tags__filtered" AS (SELECT "tags"."id", "tags"."label" FROM "tags" WHERE "tags"."label" = ?) SELECT "posts"."id" AS "id", "posts"."title" AS "title", "tags"."label" AS "tags__label", "tags"."id" AS "tags__id", "post_tags"."assigned_at" AS "tags_pivot__assigned_at" FROM "posts" LEFT JOIN "post_tags" ON "post_tags"."post_id" = "posts"."id" LEFT JOIN "tags__filtered" AS "tags" ON "tags"."id" = "post_tags"."tag_id" WHERE "posts"."title" = ?;'
      ];
      expect(filteredTaggedStatements).toEqual(expectedFilteredTaggedStatements);

      sqlLog.length = 0;
      const lazySession = new OrmSession({ orm, executor: factory.createExecutor() });
      try {
        const filteredTaggedLazyPosts = await selectFromEntity(Post)
          .select('id', 'title')
          .includeLazy('tags', {
            columns: ['label'],
            pivot: { columns: ['assigned_at'] },
            filter: eq(tagRef.label, 'history')
          })
          .where(eq(postRef.title, 'Analytical Engine'))
          .execute(lazySession);

        expect(filteredTaggedLazyPosts).toHaveLength(1);
        const historyLazyPost = filteredTaggedLazyPosts[0];
        expect(historyLazyPost.tags.map(tag => tag.label)).toEqual(['history']);

        const filteredTaggedLazyStatements = recordedSql(sqlLog);
        const expectedFilteredTaggedLazyStatements = [
          'SELECT "posts"."id" AS "id", "posts"."title" AS "title" FROM "posts" WHERE "posts"."title" = ?;',
          'SELECT "post_tags"."assigned_at" AS "assigned_at", "post_tags"."post_id" AS "post_id", "post_tags"."tag_id" AS "tag_id" FROM "post_tags" WHERE "post_tags"."post_id" IN (?);',
          'SELECT "tags"."label" AS "label", "tags"."id" AS "id" FROM "tags" WHERE "tags"."id" IN (?, ?, ?) AND "tags"."label" = ?;'
        ];
        expect(filteredTaggedLazyStatements).toEqual(expectedFilteredTaggedLazyStatements);
      } finally {
        await lazySession.dispose();
      }
    } finally {
      await factory.dispose();
    }
  });
});
