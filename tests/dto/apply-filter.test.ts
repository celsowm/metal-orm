/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { applyFilter, buildFilterExpression } from '../../src/dto/apply-filter.js';
import type { WhereInput } from '../../src/dto/filter-types.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(100),
  email: col.varchar(255),
  age: col.int(),
  active: col.boolean(),
  score: col.decimal(10, 2),
  createdAt: col.timestamp(),
});

describe('applyFilter runtime helper', () => {
  describe('applyFilter()', () => {
    it('returns unchanged query when filter is undefined', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const result = applyFilter(qb, usersTable, undefined);
      expect(result).toBe(qb);
    });

    it('returns unchanged query when filter is null', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const result = applyFilter(qb, usersTable, null);
      expect(result).toBe(qb);
    });

    it('returns unchanged query when filter is empty object', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const result = applyFilter(qb, usersTable, {});
      const sql = result.toSql('postgres');
      expect(sql).not.toContain('WHERE');
    });

    it('applies equals filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { equals: 'john' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('"users"."name"');
      expect(sql).toContain('=');
    });

    it('applies not filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { not: 'admin' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('!=');
    });

    it('applies contains filter (LIKE with wildcards)', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { contains: 'john' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('WHERE');
      expect(compiled.sql).toContain('LIKE');
      expect(compiled.params).toEqual(['%john%']);
    });

    it('applies startsWith filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        email: { startsWith: 'admin' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('LIKE');
      expect(compiled.params).toEqual(['admin%']);
    });

    it('applies endsWith filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        email: { endsWith: '@gmail.com' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('LIKE');
      expect(compiled.params).toEqual(['%@gmail.com']);
    });

    it('applies case-insensitive contains filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { contains: 'JOHN', mode: 'insensitive' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('LOWER');
      expect(compiled.sql).toContain('LIKE');
      expect(compiled.params).toEqual(['%john%']);
    });

    it('applies in filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        age: { in: [25, 30, 35] }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('IN');
      expect(compiled.params).toEqual([25, 30, 35]);
    });

    it('applies notIn filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        age: { notIn: [0, 999] }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('NOT IN');
    });

    it('applies gt/gte/lt/lte filters', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        age: { gt: 18, lte: 65 }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('>');
      expect(compiled.sql).toContain('<=');
      expect(compiled.params).toHaveLength(2);
      expect(compiled.params).toEqual(expect.arrayContaining([18, 65]));
    });

    it('applies multiple field filters (AND-ed)', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { contains: 'john' },
        active: { equals: true },
        age: { gte: 18 }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('AND');
      expect(sql).toContain('"users"."name"');
      expect(sql).toContain('"users"."active"');
      expect(sql).toContain('"users"."age"');
    });

    it('ignores unknown columns in filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter = {
        name: { equals: 'john' },
        unknownField: { equals: 'test' }
      } as WhereInput<typeof usersTable>;
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('"users"."name"');
      expect(sql).not.toContain('unknownField');
    });

    it('ignores null/undefined filter values', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        name: { equals: 'john' },
        email: undefined
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('"users"."name"');
    });
  });

  describe('buildFilterExpression()', () => {
    it('returns null for undefined filter', () => {
      const result = buildFilterExpression(usersTable, undefined);
      expect(result).toBeNull();
    });

    it('returns null for empty filter', () => {
      const result = buildFilterExpression(usersTable, {});
      expect(result).toBeNull();
    });

    it('returns single expression for single field', () => {
      const result = buildFilterExpression(usersTable, {
        name: { equals: 'john' }
      });
      expect(result).not.toBeNull();
      expect(result?.type).toBe('BinaryExpression');
    });

    it('returns AND expression for multiple fields', () => {
      const result = buildFilterExpression(usersTable, {
        name: { equals: 'john' },
        age: { gte: 18 }
      });
      expect(result).not.toBeNull();
      expect(result?.type).toBe('LogicalExpression');
      expect((result as { operator: string }).operator).toBe('AND');
    });

    it('can be combined with other conditions', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filterExpr = buildFilterExpression(usersTable, {
        name: { contains: 'john' }
      });
      expect(filterExpr).not.toBeNull();
      if (filterExpr) {
        const result = qb.where(filterExpr);
        const sql = result.toSql('postgres');
        expect(sql).toContain('WHERE');
      }
    });
  });

  describe('date filtering', () => {
    it('applies date comparison filters', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        createdAt: { gte: '2024-01-01', lt: '2025-01-01' }
      };
      const result = applyFilter(qb, usersTable, filter);
      const compiled = result.compile('postgres');
      expect(compiled.sql).toContain('>=');
      expect(compiled.sql).toContain('<');
      expect(compiled.params).toHaveLength(2);
      expect(compiled.params).toEqual(expect.arrayContaining(['2024-01-01', '2025-01-01']));
    });
  });

  describe('boolean filtering', () => {
    it('applies boolean equals filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        active: { equals: true }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('"users"."active"');
      expect(sql).toContain('=');
    });

    it('applies boolean not filter', () => {
      const qb = new SelectQueryBuilder(usersTable);
      const filter: WhereInput<typeof usersTable> = {
        active: { not: false }
      };
      const result = applyFilter(qb, usersTable, filter);
      const sql = result.toSql('postgres');
      expect(sql).toContain('!=');
    });
  });
});
