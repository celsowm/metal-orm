/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { applyFilter, buildFilterExpression } from '../../src/dto/apply-filter.js';
import type { WhereInput } from '../../src/dto/filter-types.js';
import { hasMany } from '../../src/schema/relation.js';
import { setRelations } from '../../src/schema/table.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(100),
});

const postsTable = defineTable('posts', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  title: col.varchar(200),
});

setRelations(usersTable, {
  posts: hasMany(postsTable, 'user_id'),
});

describe('applyFilter edge cases', () => {
  it('escapes special LIKE characters in contains filters', () => {
    const qb = new SelectQueryBuilder(usersTable);
    const filter: WhereInput<typeof usersTable> = {
      name: { contains: '50%_\\' }
    };
    const compiled = applyFilter(qb, usersTable, filter).compile('postgres');
    expect(compiled.params).toEqual(['%50\\%\\_\\\\%']);
  });

  it('ignores relation filter with empty "some" object', () => {
    const qb = new SelectQueryBuilder(usersTable);
    const filter = {
      posts: { some: {} }
    } as WhereInput<typeof usersTable>;
    const sql = applyFilter(qb, usersTable, filter).toSql('sqlite');
    expect(sql).not.toContain('JOIN');
    expect(sql).not.toContain('EXISTS');
    expect(sql).not.toContain('WHERE');
  });

  it('applies case-insensitive startsWith and endsWith filters', () => {
    const qb = new SelectQueryBuilder(usersTable);
    const filter: WhereInput<typeof usersTable> = {
      name: { startsWith: 'Admin', mode: 'insensitive' },
    };
    const compiled = applyFilter(qb, usersTable, filter).compile('postgres');
    expect(compiled.sql).toContain('LOWER');
    expect(compiled.sql).toContain('LIKE');
    expect(compiled.params).toEqual(['admin%']);

    const qb2 = new SelectQueryBuilder(usersTable);
    const filter2: WhereInput<typeof usersTable> = {
      name: { endsWith: '@GMAIL.COM', mode: 'insensitive' }
    };
    const compiled2 = applyFilter(qb2, usersTable, filter2).compile('postgres');
    expect(compiled2.sql).toContain('LOWER');
    expect(compiled2.sql).toContain('LIKE');
    expect(compiled2.params).toEqual(['%@gmail.com']);
  });

  it('applies both some and isEmpty when both are provided', () => {
    const qb = new SelectQueryBuilder(usersTable);
    const filter: WhereInput<typeof usersTable> = {
      posts: {
        some: { title: { contains: 'draft' } },
        isEmpty: true
      }
    };
    const sql = applyFilter(qb, usersTable, filter).toSql('sqlite');
    expect(sql).toContain('INNER JOIN');
    expect(sql).toContain('DISTINCT');
    expect(sql).toContain('NOT EXISTS');
  });

  it('buildFilterExpression supports relation filters', () => {
    const expr = buildFilterExpression(usersTable, {
      posts: {
        some: { title: { contains: 'draft' } }
      }
    } as WhereInput<typeof usersTable>);
    expect(expr).not.toBeNull();
    expect(expr?.type).toBe('ExistsExpression');
  });

  it('buildFilterExpression supports relation none filter', () => {
    const expr = buildFilterExpression(usersTable, {
      posts: {
        none: { title: { contains: 'draft' } }
      }
    } as WhereInput<typeof usersTable>);
    expect(expr).not.toBeNull();
    expect(expr?.type).toBe('ExistsExpression');
    expect((expr as { operator?: string }).operator).toBe('NOT EXISTS');
  });

  it('buildFilterExpression supports relation every filter', () => {
    const expr = buildFilterExpression(usersTable, {
      posts: {
        every: { title: { contains: 'draft' } }
      }
    } as WhereInput<typeof usersTable>);
    expect(expr).not.toBeNull();
    expect(expr?.type).toBe('ExistsExpression');
    expect((expr as { operator?: string }).operator).toBe('EXISTS');
  });

  it('throws when relation filter has no operators', () => {
    expect(() => buildFilterExpression(usersTable, {
      posts: {
        title: { contains: 'draft' }
      }
    } as WhereInput<typeof usersTable>)).toThrow(
      'Relation filter "posts" must include at least one of "some", "none", "every", "isEmpty", or "isNotEmpty".'
    );
  });
});
