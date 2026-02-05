import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { updateInclude } from '../../src/query-builder/update-include.js';
import { TableDef } from '../../src/schema/table.js';
import { RelationKinds } from '../../src/schema/relation.js';
import { eq, and } from '../../src/core/ast/expression.js';
import { JOIN_KINDS } from '../../src/core/sql/sql.js';

// Mock tables with explicit table references in columns
const userTable: TableDef = {
  name: 'users',
  schema: 'public',
  columns: {
    id: { name: 'id', type: 'integer', table: 'users' } as any,
    name: { name: 'name', type: 'text', table: 'users' } as any
  },
  relations: {}
};

const postTable: TableDef = {
  name: 'posts',
  schema: 'public',
  columns: {
    id: { name: 'id', type: 'integer', table: 'posts' } as any,
    userId: { name: 'user_id', type: 'integer', table: 'posts' } as any,
    title: { name: 'title', type: 'text', table: 'posts' } as any
  },
  relations: {}
};

const commentTable: TableDef = {
  name: 'comments',
  schema: 'public',
  columns: {
    id: { name: 'id', type: 'integer', table: 'comments' } as any,
    postId: { name: 'post_id', type: 'integer', table: 'comments' } as any
  },
  relations: {}
};

// Setup relations
userTable.relations = {
  posts: {
    type: RelationKinds.HasMany,
    target: postTable,
    foreignKey: 'user_id', // Note: using actual column name string if needed, or property name
    localKey: 'id'
  } as any
};

postTable.relations = {
  comments: {
    type: RelationKinds.HasMany,
    target: commentTable,
    foreignKey: 'post_id',
    localKey: 'id'
  } as any
};

describe('updateInclude SQL verification', () => {
  it('should generate INNER JOIN and filter when using updateInclude for filtering', () => {
    const qb = new SelectQueryBuilder(userTable);

    // Simulate applyFilter logic for "some"
    const predicate = eq(postTable.columns.title, 'Hello');
    const qbFiltered = updateInclude(qb, 'posts', (opts) => ({
      ...opts,
      joinKind: JOIN_KINDS.INNER,
      filter: opts.filter ? and(opts.filter, predicate) : predicate
    }));

    const sql = qbFiltered.toSql('sqlite');

    // Should have INNER JOIN and the filter
    expect(sql).toContain('INNER JOIN "public"."posts"');
    expect(sql).toContain('"posts"."title" = ?');
  });

  it('should handle nested deep SQL generation', () => {
    const qb = new SelectQueryBuilder(userTable);

    const predicate = eq(commentTable.columns.id, 1);
    const qbFiltered = updateInclude(qb, 'posts.comments', (opts) => ({
      ...opts,
      joinKind: JOIN_KINDS.INNER,
      filter: opts.filter ? and(opts.filter, predicate) : predicate
    }));

    const sql = qbFiltered.toSql('sqlite');

    // Should have BOTH joins and the deep filter
    expect(sql).toContain('LEFT JOIN "public"."posts"');
    expect(sql).toContain('INNER JOIN "public"."comments"');
    expect(sql).toContain('"comments"."id" = ?');
  });

  it('should allow forcing intermediate joins to INNER via deep path', () => {
    const qb = new SelectQueryBuilder(userTable);

    let updated = updateInclude(qb, 'posts', (opts) => ({ ...opts, joinKind: JOIN_KINDS.INNER }));
    updated = updateInclude(updated, 'posts.comments', (opts) => ({ ...opts, joinKind: JOIN_KINDS.INNER }));

    const sql = updated.toSql('sqlite');

    expect(sql).toContain('INNER JOIN "public"."posts"');
    expect(sql).toContain('INNER JOIN "public"."comments"');
  });
});
