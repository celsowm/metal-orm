import { describe, it, expect, vi } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column.js';
import { hasMany } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq } from '../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { OrmContext } from '../../src/orm/orm-context.js';
import { createMysqlExecutor } from '../../src/core/execution/executors/mysql-executor.js';

describe('README Level 2 - ORM runtime', () => {
  it('should create OrmContext and load entities with lazy relations', async () => {
    const posts = defineTable('posts', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
      userId: col.int(),
      createdAt: col.timestamp(),
    });

    const users = defineTable('users', {
      id: col.primaryKey(col.int()),
      name: col.varchar(255),
      email: col.varchar(255),
    });

    // Add relations
    users.relations = {
      posts: hasMany(posts, 'userId'),
    };

    // Create mock MySQL client
    const mockClient = {
      async query(sql: string, params: unknown[]) {
        // Mock response for user query
        if (sql.includes('users')) {
          return [[{ id: 1, name: 'John Doe', email: 'john@example.com' }], {}] as [any, any?];
        }
        // Mock response for posts query
        if (sql.includes('posts')) {
          return [[{ id: 101, title: 'Latest Post', userId: 1, createdAt: '2023-05-15T10:00:00Z' }], {}] as [any, any?];
        }
        return [[], {}] as [any, any?];
      }
    };

    // Create executor using the new helper
    const executor = createMysqlExecutor(mockClient);

    // Create OrmContext
    const ctx = new OrmContext({
      dialect: new MySqlDialect(),
      executor
    });

    // Load entities with lazy relations
    const [user] = await new SelectQueryBuilder(users)
      .select({
        id: users.columns.id,
        name: users.columns.name,
        email: users.columns.email,
      })
      .where(eq(users.columns.id, 1))
      .execute(ctx);

    // Verify user entity
    expect(user).toBeDefined();
    expect(user.id).toBe(1);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');

    // Verify lazy relations exist
    expect(user.posts).toBeDefined();
    // Type assertion for testing purposes
    expect((user.posts as any).load).toBeDefined();
  });
});
