import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
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
import {
  closeDb,
  createSqliteSessionFromDb,
  execSql,
  runSql
} from './sqlite-helpers.ts';

@Entity()
class DecoratedUser {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email?: string;

  @HasMany({
    target: () => DecoratedPost,
    foreignKey: 'userId'
  })
  posts!: HasManyCollection<DecoratedPost>;
}

@Entity()
class DecoratedPost {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @Column(col.int())
  userId!: number;

  @BelongsTo({
    target: () => DecoratedUser,
    foreignKey: 'userId'
  })
  user?: DecoratedUser;
}

describe('SQLite decorator e2e', () => {
  it('hydrates decorator entities through sqlite3 in-memory', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const userTable = getTableDefFromEntity(DecoratedUser);
      const postTable = getTableDefFromEntity(DecoratedPost);
      expect(userTable).toBeDefined();
      expect(postTable).toBeDefined();
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'decorated_users' }),
          expect.objectContaining({ name: 'decorated_posts' })
        ])
      );

      await execSql(
        db,
        `
          CREATE TABLE decorated_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT
          );
        `
      );

      await execSql(
        db,
        `
          CREATE TABLE decorated_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            userId INTEGER NOT NULL
          );
        `
      );

      await runSql(
        db,
        'INSERT INTO decorated_users (name, email) VALUES (?, ?);',
        ['Alice', 'alice@example.com']
      );

      await runSql(
        db,
        'INSERT INTO decorated_users (name, email) VALUES (?, ?);',
        ['Bob', 'bob@example.com']
      );

      await runSql(
        db,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Alice Post 1', 1]
      );

      await runSql(
        db,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Alice Post 2', 1]
      );

      await runSql(
        db,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Bob Post', 2]
      );

      const session = createSqliteSessionFromDb(db);
      const columns = userTable!.columns;

      const [user] = await selectFromEntity(DecoratedUser)
        .select({
          id: columns.id,
          name: columns.name,
          email: columns.email
        })
        .includeLazy('posts')
        .where(eq(columns.name, 'Alice'))
        .orderBy(columns.id)
        .execute(session);

      expect(user).toBeDefined();
      expect(user!.email).toBe('alice@example.com');

      const posts = await user!.posts.load();
      expect(posts).toHaveLength(2);
      expect(posts.map(post => post.title).sort()).toEqual(['Alice Post 1', 'Alice Post 2']);
    } finally {
      await closeDb(db);
    }
  });
});


