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
  createSqliteSessionFromDb,
  execSql,
  runSql
} from '../e2e/sqlite-helpers.ts';

describe('relation typing hydration e2e', () => {
  afterEach(() => {
    clearEntityMetadata();
  });

  it('hydrates column selection with decorated Level 3 setup', async () => {
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

    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();
      const userTable = getTableDefFromEntity(RelationHydrationUser);
      const postTable = getTableDefFromEntity(RelationHydrationPost);

      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();

      await execSql(
        db,
        `
        CREATE TABLE ${userTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          email TEXT NOT NULL
        );
      `
      );

      await execSql(
        db,
        `
        CREATE TABLE ${postTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          userId INTEGER NOT NULL
        );
      `
      );

      await runSql(
        db,
        `INSERT INTO ${userTable!.name} (firstName, email) VALUES (?, ?);`,
        ['Alice', 'alice@example.com']
      );

      await runSql(
        db,
        `INSERT INTO ${postTable!.name} (title, userId) VALUES (?, ?);`,
        ['First Decorated Post', 1]
      );

      const session = createSqliteSessionFromDb(db);
      const posts = await selectFromEntity(RelationHydrationPost)
        .select('id', 'title')
        .selectRelationColumns('user', 'firstName', 'email')
        .execute(session);

      expect(posts).toHaveLength(1);
      expect(posts[0].user.firstName).toBe('Alice');
      expect(posts[0].user.email).toBe('alice@example.com');

      const eagerPosts = await selectFromEntity(RelationHydrationPost)
        .select('id', 'title')
        .include('user', { columns: ['firstName', 'email'] })
        .execute(session);

      expect(eagerPosts).toHaveLength(1);
      expect(eagerPosts[0].user.firstName).toBe('Alice');
      expect(eagerPosts[0].user.email).toBe('alice@example.com');
    } finally {
      await closeDb(db);
    }
  });
});
