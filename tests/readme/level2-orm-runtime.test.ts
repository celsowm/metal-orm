import { describe, it, expect, vi } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { hasMany } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq } from '../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { createMysqlExecutor } from '../../src/core/execution/executors/mysql-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';

describe('README Level 2 - ORM runtime', () => {
  it('should create OrmSession and load entities with lazy relations', async () => {
    const posts = defineTable('posts', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
      userId: col.int(),
      createdAt: col.timestamp()
    });

    const users = defineTable('users', {
      id: col.primaryKey(col.int()),
      name: col.varchar(255),
      email: col.varchar(255)
    });

    users.relations = {
      posts: hasMany(posts, 'userId')
    };

    const mockClient = {
      async query(sql: string, params: unknown[]) {
        if (sql.includes('users')) {
          return [[{ id: 1, name: 'John Doe', email: 'john@example.com' }], {}] as [any, any?];
        }
        if (sql.includes('posts')) {
          return [[{ id: 101, title: 'Latest Post', userId: 1, createdAt: '2023-05-15T10:00:00Z' }], {}] as [any, any?];
        }
        return [[], {}] as [any, any?];
      }
    };

    const executor = createMysqlExecutor(mockClient);
    const factory = {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    };
    const orm = new Orm({
      dialect: new MySqlDialect(),
      executorFactory: factory
    });
    const session = new OrmSession({ orm, executor });

    const [user] = await new SelectQueryBuilder(users)
      .select({
        id: users.columns.id,
        name: users.columns.name,
        email: users.columns.email
      })
      .where(eq(users.columns.id, 1))
      .execute(session);

    expect(user).toBeDefined();
    expect(user.id).toBe(1);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');

    expect(user.posts).toBeDefined();
    expect((user.posts as any).load).toBeDefined();
  });
});


