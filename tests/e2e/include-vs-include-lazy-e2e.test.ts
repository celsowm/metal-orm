import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsTo,
  bootstrapEntities,
  selectFromEntity,
  getTableDefFromEntity
} from '../../src/decorators/index.js';
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

  it('compares include and includeLazy query counts via pooled executor', async () => {
    @Entity()
    class RelationHydrationUser {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      firstName!: string;

      @Column(col.varchar(255))
      email!: string;
    }

    @Entity()
    class RelationHydrationPost {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      userId!: number;

      @BelongsTo({
        target: () => RelationHydrationUser,
        foreignKey: 'userId'
      })
      user!: RelationHydrationUser;
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
      const userTable = getTableDefFromEntity(RelationHydrationUser);
      const postTable = getTableDefFromEntity(RelationHydrationPost);

      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();

      await session.executor.executeSql(`
        CREATE TABLE ${userTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          email TEXT NOT NULL
        );
      `);

      await session.executor.executeSql(`
        CREATE TABLE ${postTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          userId INTEGER NOT NULL
        );
      `);

      await session.executor.executeSql(
        `INSERT INTO ${userTable!.name} (firstName, email) VALUES (?, ?);`,
        ['Alice', 'alice@example.com']
      );

      await session.executor.executeSql(
        `INSERT INTO ${postTable!.name} (title, userId) VALUES (?, ?);`,
        ['First Decorated Post', 1]
      );

      sqlLog.length = 0;

      const lazyPosts = await selectFromEntity(RelationHydrationPost)
        .select('id', 'title')
        .includeLazy('user', { columns: ['firstName', 'email'] })
        .execute(session);

      expect(lazyPosts).toHaveLength(1);
      expect(lazyPosts[0].user.firstName).toBe('Alice');
      expect(lazyPosts[0].user.email).toBe('alice@example.com');

      const lazyStatements = recordedSql(sqlLog);
      const expectedLazyStatements = [
        'SELECT "relation_hydration_posts"."id" AS "id", "relation_hydration_posts"."title" AS "title", "relation_hydration_posts"."userId" AS "userId" FROM "relation_hydration_posts";',
        'SELECT "relation_hydration_users"."firstName" AS "firstName", "relation_hydration_users"."email" AS "email", "relation_hydration_users"."id" AS "id" FROM "relation_hydration_users" WHERE "relation_hydration_users"."id" IN (?);'
      ];
      expect(lazyStatements).toEqual(expectedLazyStatements);

      sqlLog.length = 0;

      const eagerPosts = await selectFromEntity(RelationHydrationPost)
        .select('id', 'title')
        .include('user', { columns: ['firstName', 'email'] })
        .execute(session);

      expect(eagerPosts).toHaveLength(1);
      expect(eagerPosts[0].user.firstName).toBe('Alice');
      expect(eagerPosts[0].user.email).toBe('alice@example.com');

      const eagerStatements = recordedSql(sqlLog);
      const expectedEagerStatements = [
        'SELECT "relation_hydration_posts"."id" AS "id", "relation_hydration_posts"."title" AS "title", "relation_hydration_posts"."userId" AS "userId", "relation_hydration_users"."firstName" AS "user__firstName", "relation_hydration_users"."email" AS "user__email", "relation_hydration_users"."id" AS "user__id" FROM "relation_hydration_posts" LEFT JOIN "relation_hydration_users" ON "relation_hydration_users"."id" = "relation_hydration_posts"."userId";'
      ];
      expect(eagerStatements).toEqual(expectedEagerStatements);
      expect(lazyStatements.length).toBeGreaterThan(eagerStatements.length);
    } finally {
      await factory.dispose();
    }
  });
});
