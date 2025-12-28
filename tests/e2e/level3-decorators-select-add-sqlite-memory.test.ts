import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

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
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

describe('Level 3 - Decorators selectFromEntity add (SQLite Memory)', () => {
  it('persists has-many add after selectFromEntity', async () => {
    clearEntityMetadata();

    @Entity()
    class User {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      name!: string;

      @HasMany({
        target: () => Post,
        foreignKey: 'userId'
      })
      posts!: HasManyCollection<Post>;
    }

    @Entity()
    class Post {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      title!: string;

      @Column(col.notNull(col.int()))
      userId!: number;

      @BelongsTo({
        target: () => User,
        foreignKey: 'userId'
      })
      user?: User;
    }

    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();
      const userTable = getTableDefFromEntity(User)!;
      const postTable = getTableDefFromEntity(Post)!;

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        userTable,
        postTable
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Ada']);

      const [user] = await selectFromEntity(User)
        .select('id', 'name')
        .includeLazy('posts')
        .execute(session);

      user.posts.add({ title: 'From selectFromEntity' });
      await session.commit();

      const posts = await selectFromEntity(Post)
        .select('id', 'title', 'userId')
        .orderBy(postTable.columns.id)
        .executePlain(session);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({
        title: 'From selectFromEntity',
        userId: 1
      });
    } finally {
      await closeDb(db);
      clearEntityMetadata();
    }
  });
});
