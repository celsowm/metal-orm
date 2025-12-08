import { describe, it, expect } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column.js';
import { hasMany } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq } from '../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';

describe('README Level 1 - Relations & hydration', () => {
  it('should create tables with relations and build queries with joins', () => {
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

    // Build a query with join
    const builder = new SelectQueryBuilder(users)
      .select({
        id: users.columns.id,
        name: users.columns.name,
        email: users.columns.email,
      })
      .leftJoin(posts, eq(posts.columns.userId, users.columns.id))
      .where(eq(users.columns.id, 1))
      .limit(10);

    const dialect = new MySqlDialect();
    const { sql, params } = builder.compile(dialect);

    // Verify SQL structure
    expect(sql).toContain('SELECT');
    expect(sql).toContain('users');
    expect(sql).toContain('LEFT JOIN');
    expect(sql).toContain('posts');
    expect(sql).toContain('WHERE');
    expect(sql).toContain('LIMIT');
    expect(params).toEqual([1]);
  });
});
