import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import type { BelongsToReference } from '../../src/schema/types.js';
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

describe('README Level 3 - Column selection type safety (SQLite e2e)', () => {
  afterEach(() => {
    clearEntityMetadata();
  });

  it('hydrates relation columns when spreading column lists via selectRelationColumns', async () => {
    @Entity()
    class ColumnSelectionUser {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      firstName!: string;

      @Column(col.varchar(255))
      lastName!: string;

      @Column(col.varchar(255))
      email?: string;
    }

    @Entity()
    class ColumnSelectionPost {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      userId!: number;

      @BelongsTo({
        target: () => ColumnSelectionUser,
        foreignKey: 'userId',
      })
      user!: ColumnSelectionUser;
    }

    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();

      const userTable = getTableDefFromEntity(ColumnSelectionUser);
      const postTable = getTableDefFromEntity(ColumnSelectionPost);

      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();

      await execSql(
        db,
        `
        CREATE TABLE ${userTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          lastName TEXT NOT NULL,
          email TEXT
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
        `INSERT INTO ${userTable!.name} (firstName, lastName, email) VALUES (?, ?, ?);`,
        ['Alice', 'Anderson', 'alice@example.com']
      );

      await runSql(
        db,
        `INSERT INTO ${userTable!.name} (firstName, lastName, email) VALUES (?, ?, ?);`,
        ['Bob', 'Builder', 'bob@builder.com']
      );

      await runSql(
        db,
        `INSERT INTO ${postTable!.name} (title, userId) VALUES (?, ?);`,
        ['First Post', 1]
      );

      await runSql(
        db,
        `INSERT INTO ${postTable!.name} (title, userId) VALUES (?, ?);`,
        ['Second Post', 2]
      );

      const session = createSqliteSessionFromDb(db);

      const postColumns = ['id', 'title'] as const;
      const relationColumns = ['firstName', 'email'] as const;

      const posts = await selectFromEntity(ColumnSelectionPost)
        .select(...postColumns)
        .selectRelationColumns('user', ...relationColumns)
        .orderBy(postTable!.columns.id, 'ASC')
        .execute(session);

      expect(posts).toHaveLength(2);

      const [firstPost, secondPost] = posts;
      const firstUser = firstPost.user as BelongsToReference<ColumnSelectionUser>;
      const secondUser = secondPost.user as BelongsToReference<ColumnSelectionUser>;

      expect(firstUser.get()).toMatchObject({
        firstName: 'Alice',
        email: 'alice@example.com'
      });
      expect(secondUser.get()).toMatchObject({
        firstName: 'Bob',
        email: 'bob@builder.com'
      });
    } finally {
      await closeDb(db);
    }
  });
});
