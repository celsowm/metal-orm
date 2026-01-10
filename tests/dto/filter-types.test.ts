/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import type {
  WhereInput,
  SimpleWhereInput,
  StringFilter,
  NumberFilter,
  BooleanFilter,
  DateFilter
} from '../../src/dto/index.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(100),
  email: col.varchar(255),
  age: col.int(),
  active: col.boolean(),
  score: col.decimal(10, 2),
  createdAt: col.timestamp(),
});

describe('Filter Type Utilities', () => {
  describe('WhereInput<T>', () => {
    it('allows empty filter', () => {
      const emptyFilter: WhereInput<typeof usersTable> = {};
      expect(Object.keys(emptyFilter).length).toBe(0);
    });

    it('allows partial filter', () => {
      const partialFilter: WhereInput<typeof usersTable> = {
        name: { contains: 'john' }
      };
      expect(partialFilter.name?.contains).toBe('john');
    });

    it('allows multiple field filters', () => {
      const multiFilter: WhereInput<typeof usersTable> = {
        name: { contains: 'john' },
        age: { gte: 18 },
        active: { equals: true }
      };
      expect(multiFilter.name?.contains).toBe('john');
      expect(multiFilter.age?.gte).toBe(18);
      expect(multiFilter.active?.equals).toBe(true);
    });
  });

  describe('SimpleWhereInput<T, K>', () => {
    it('restricts to specified columns only', () => {
      const restrictedFilter: SimpleWhereInput<typeof usersTable, 'name' | 'email'> = {
        name: { contains: 'john' },
        email: { endsWith: '@gmail.com' }
      };
      expect(restrictedFilter.name?.contains).toBe('john');
      expect(restrictedFilter.email?.endsWith).toBe('@gmail.com');
    });
  });

  describe('StringFilter operators', () => {
    it('supports all string operators', () => {
      const filter: StringFilter = {
        equals: 'test',
        not: 'other',
        in: ['a', 'b'],
        notIn: ['c', 'd'],
        contains: 'est',
        startsWith: 'te',
        endsWith: 'st',
        mode: 'insensitive'
      };

      expect(filter.equals).toBe('test');
      expect(filter.contains).toBe('est');
      expect(filter.mode).toBe('insensitive');
    });
  });

  describe('NumberFilter operators', () => {
    it('supports all number operators', () => {
      const filter: NumberFilter = {
        equals: 42,
        not: 0,
        in: [1, 2, 3],
        notIn: [4, 5],
        lt: 100,
        lte: 100,
        gt: 0,
        gte: 1
      };

      expect(filter.equals).toBe(42);
      expect(filter.gt).toBe(0);
      expect(filter.lte).toBe(100);
    });
  });

  describe('BooleanFilter operators', () => {
    it('supports boolean operators', () => {
      const filter: BooleanFilter = {
        equals: true,
        not: false
      };

      expect(filter.equals).toBe(true);
      expect(filter.not).toBe(false);
    });
  });

  describe('DateFilter operators', () => {
    it('supports all date operators', () => {
      const filter: DateFilter = {
        equals: '2024-01-01',
        not: '2024-01-02',
        in: ['2024-01-01', '2024-01-02'],
        notIn: ['2024-12-31'],
        lt: '2025-01-01',
        lte: '2024-12-31',
        gt: '2024-01-01',
        gte: '2024-01-01'
      };

      expect(filter.equals).toBe('2024-01-01');
      expect(filter.gt).toBe('2024-01-01');
    });
  });
});
