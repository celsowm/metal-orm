import { describe, expect, it } from 'vitest';

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
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { MySqlSchemaDialect } from '../../src/core/ddl/dialects/mysql-schema-dialect.js';
import {
  stopMysqlServer,
  createMysqlServer,
  runSql
} from './mysql-helpers.ts';

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

describe('MySQL decorator e2e', () => {
  it('hydrates decorator entities through mysql-memory-server', async () => {
    const setup = await createMysqlServer();

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

      await executeSchemaSqlFor(
        setup.session.executor,
        new MySqlSchemaDialect(),
        userTable!,
        postTable!
      );

      await runSql(
        setup.connection,
        'INSERT INTO decorated_users (name, email) VALUES (?, ?);',
        ['Alice', 'alice@example.com']
      );

      await runSql(
        setup.connection,
        'INSERT INTO decorated_users (name, email) VALUES (?, ?);',
        ['Bob', 'bob@example.com']
      );

      await runSql(
        setup.connection,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Alice Post 1', 1]
      );

      await runSql(
        setup.connection,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Alice Post 2', 1]
      );

      await runSql(
        setup.connection,
        'INSERT INTO decorated_posts (title, userId) VALUES (?, ?);',
        ['Bob Post', 2]
      );

      const columns = userTable!.columns;

      const [user] = await selectFromEntity(DecoratedUser)
        .select({
          id: columns.id,
          name: columns.name,
          email: columns.email
        })
        .includeLazy('posts', {
          columns: ['title'],
          filter: eq(postTable!.columns.title, 'Alice Post 1')
        })
        .where(eq(columns.name, 'Alice'))
        .orderBy(columns.id)
        .execute(setup.session);

      expect(user).toBeDefined();
      expect(user!.email).toBe('alice@example.com');

      const posts = await user!.posts.load();
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Alice Post 1');
      expect(posts[0].id).toBeDefined();
      expect(posts[0].userId).toBeUndefined();
    } finally {
      await stopMysqlServer(setup);
    }
  });
});
