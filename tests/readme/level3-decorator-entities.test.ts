import { describe, it, expect } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq } from '../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  HasMany,
  BelongsTo,
  bootstrapEntities,
  selectFromEntity,
  getTableDefFromEntity
} from '../../src/decorators/index.js';

describe('README Level 3 - Decorator entities', () => {
  it('should create decorator entities and bootstrap metadata', () => {
    @Entity()
    class User {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      name!: string;

      @Column(col.varchar(255))
      email?: string;

      @HasMany({
        target: () => Post,
        foreignKey: 'userId',
      })
      posts!: any;
    }

    @Entity()
    class Post {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      userId!: number;

      @BelongsTo({
        target: () => User,
        foreignKey: 'userId',
      })
      user!: any;
    }

    // Bootstrap metadata
    const tables = bootstrapEntities();

    // Verify tables were created
    expect(tables).toBeDefined();
    expect(tables.length).toBeGreaterThan(0);

    // Find user and post tables
    const userTable = tables.find(t => t.name === 'users');
    const postTable = tables.find(t => t.name === 'posts');

    expect(userTable).toBeDefined();
    expect(postTable).toBeDefined();

    // Verify relations
    expect(userTable?.relations.posts).toBeDefined();
    expect(postTable?.relations.user).toBeDefined();
  });

  it('should use selectFromEntity to query from decorator classes', () => {
    @Entity()
    class TestUser {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      name!: string;
    }

    // Bootstrap to register entities
    bootstrapEntities();

    // Use selectFromEntity
    const builder = selectFromEntity(TestUser);

    // Verify builder was created
    expect(builder).toBeDefined();
    expect(builder.getTable().name).toBe('test_users');
  });
});


