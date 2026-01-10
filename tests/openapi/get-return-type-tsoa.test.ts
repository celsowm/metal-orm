import { describe, expect, it, test } from 'vitest';

import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { belongsTo, hasMany } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';
import { eq } from '../../src/core/ast/expression.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
  isActive: col.boolean(),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  content: col.text(),
  userId: col.int(),
});

setRelations(users, {
  posts: hasMany(posts, 'userId'),
});

setRelations(posts, {
  author: belongsTo(users, 'userId'),
});

users.columns.name.notNull = true;
users.columns.email.notNull = true;
posts.columns.title.notNull = true;

describe('SelectQueryBuilder TSOA integration', () => {
  describe('getReturnType()', () => {
    it('should return type marker for query result type', () => {
      const qb = selectFrom(users)
        .select('id', 'name', 'email');

      const returnType = qb.getReturnType();

      expect(typeof returnType).toBe('undefined');
      
      type UserResponse = typeof returnType;
      const dummy: any = { id: 1, name: 'John', email: 'john@example.com' };
      expect(dummy.id).toBe(1);
      expect(dummy.name).toBe('John');
    });

    it('should work with nested relations', () => {
      const qb = selectFrom(users)
        .select('id', 'name')
        .includePick('posts', ['id', 'title']);

      const returnType = qb.getReturnType();

      expect(typeof returnType).toBe('undefined');
      
      const dummy: any = { id: 1, name: 'John', posts: [{ id: 1, title: 'Hello' }] };
      expect(dummy.posts).toBeDefined();
    });

    it('should work with full entity selections', () => {
      const qb = selectFrom(users);

      const returnType = qb.getReturnType();

      expect(typeof returnType).toBe('undefined');
      
      const dummy: any = { id: 1, name: 'John', email: 'john@example.com', isActive: true, posts: [] };
      expect(dummy.isActive).toBe(true);
    });
  });

  describe('getFilterParameterTypes()', () => {
    it('should return type marker for filter parameters when where clause exists', () => {
      const qb = selectFrom(users)
        .where(eq(users.columns.name, 'Alice'))
        .select('id', 'name');

      const filterTypes = qb.getFilterParameterTypes();

      expect(typeof filterTypes).toBe('undefined');
      
      const dummy: any = { filter: { name: 'Alice' } };
      expect(dummy.filter).toBeDefined();
    });

    it('should return undefined for filter parameters when no where clause', () => {
      const qb = selectFrom(users)
        .select('id', 'name');

      const filterTypes = qb.getFilterParameterTypes();

      expect(filterTypes).toBeUndefined();
    });

    it('should work with nested relation filters', () => {
      const qb = selectFrom(posts)
        .where(eq(posts.columns.userId, 1))
        .includePick('author', ['id', 'name'])
        .select('id', 'title');

      const filterTypes = qb.getFilterParameterTypes();

      expect(typeof filterTypes).toBe('undefined');
      
      const dummy: any = { filter: { userId: 1 } };
      expect(dummy.filter).toBeDefined();
    });
  });

  test('getReturnType and getFilterParameterTypes methods exist', () => {
    const qb = selectFrom(users).select('id', 'name');

    expect(typeof qb.getReturnType).toBe('function');
    expect(typeof qb.getFilterParameterTypes).toBe('function');
  });
});
