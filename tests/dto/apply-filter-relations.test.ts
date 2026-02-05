/// <reference types="vitest" />

import { describe, it, expect, beforeEach } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { applyFilter } from '../../src/dto/apply-filter.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import type { WhereInput } from '../../src/dto/filter-types.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(100),
  email: col.varchar(255),
  active: col.boolean(),
});

const postsTable = defineTable('posts', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  title: col.varchar(200),
  content: col.text(),
  published: col.boolean(),
});

usersTable.relations = {
  posts: hasMany(postsTable, 'user_id'),
};

postsTable.relations = {
  author: belongsTo(usersTable, 'user_id'),
};

describe('applyFilter with relations', () => {
  const dialect = new SqliteDialect();

  describe('some filter', () => {
    it('generates JOIN + DISTINCT for hasMany relation with contains', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          some: {
            title: { contains: 'tutorial' }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('INNER JOIN');
    });

    it('generates JOIN + DISTINCT for hasMany relation with equals', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          some: {
            published: { equals: true as unknown as string }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('INNER JOIN');
    });

    it('generates correct JOIN for belongsTo relation', () => {
      const qb = new SelectQueryBuilder(postsTable);
      const filter: WhereInput<typeof postsTable> = {
        author: {
          some: {
            name: { equals: 'John' }
          }
        }
      } as WhereInput<typeof postsTable>;
      const result = applyFilter(qb, postsTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('INNER JOIN');
    });
  });

  describe('none filter', () => {
    it('generates NOT EXISTS for hasMany relation', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          none: {
            published: { equals: true as unknown as string }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('NOT EXISTS');
    });

    it('generates NOT EXISTS for hasMany relation with contains', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          none: {
            title: { contains: 'draft' }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('NOT EXISTS');
    });
  });

  describe('isEmpty filter', () => {
    it('generates NOT EXISTS for isEmpty true', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          isEmpty: true
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('NOT EXISTS');
    });

    it('generates EXISTS for isEmpty false', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          isEmpty: false
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('EXISTS');
    });
  });

  describe('every filter', () => {
    it('generates GROUP BY + HAVING for hasMany relation', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          every: {
            published: { equals: true as unknown as string }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('HAVING');
    });
  });

  describe('combined filters', () => {
    it('applies column and relation filters together', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { contains: 'John' },
        posts: {
          some: {
            title: { contains: 'tutorial' }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('WHERE');
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('INNER JOIN');
    });

    it('applies multiple relation filters', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        posts: {
          some: {
            title: { contains: 'tutorial' }
          },
          none: {
            content: { contains: 'spam' }
          }
        }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql(dialect);
      console.log('SQL:', sql);
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain('INNER JOIN');
      expect(sql).toContain('NOT EXISTS');
    });
  });
});
