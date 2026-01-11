/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import {
  toPagedResponse,
  toPagedResponseBuilder,
  calculateTotalPages,
  hasNextPageMeta,
  hasPrevPageMeta,
  computePaginationMetadata
} from '../../src/dto/index.js';

type TestItem = { id: number; name: string };

const mockItems: TestItem[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
];

describe('Pagination Utilities', () => {
  describe('toPagedResponse()', () => {
    it('converts basic PaginatedResult to PagedResponse', () => {
      const basic = {
        items: mockItems,
        totalItems: 150,
        page: 2,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.items).toEqual(mockItems);
      expect(result.totalItems).toBe(150);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(8);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
    });

    it('calculates totalPages correctly with remainder', () => {
      const basic = {
        items: mockItems,
        totalItems: 45,
        page: 1,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.totalPages).toBe(3);
    });

    it('handles exact division', () => {
      const basic = {
        items: mockItems,
        totalItems: 40,
        page: 1,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.totalPages).toBe(2);
    });

    it('returns hasNextPage false on last page', () => {
      const basic = {
        items: mockItems,
        totalItems: 150,
        page: 8,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
    });

    it('returns hasPrevPage false on first page', () => {
      const basic = {
        items: mockItems,
        totalItems: 150,
        page: 1,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.hasPrevPage).toBe(false);
      expect(result.hasNextPage).toBe(true);
    });

    it('returns both false when only one page', () => {
      const basic = {
        items: mockItems,
        totalItems: 5,
        page: 1,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });

    it('returns both false when no items', () => {
      const basic = {
        items: [],
        totalItems: 0,
        page: 1,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });
  });

  describe('toPagedResponseBuilder()', () => {
    it('creates builder with fixed pageSize', () => {
      const builder = toPagedResponseBuilder<TestItem>(20);

      const result = builder({
        items: mockItems,
        totalItems: 150,
        page: 2,
      });

      expect(result.pageSize).toBe(20);
      expect(result.page).toBe(2);
      expect(result.totalItems).toBe(150);
      expect(result.totalPages).toBe(8);
    });

    it('overrides pageSize if provided', () => {
      const builder = toPagedResponseBuilder<TestItem>(20);

      const result = builder({
        items: mockItems,
        totalItems: 150,
        page: 2,
        pageSize: 10,
      });

      expect(result.pageSize).toBe(20);
    });

    it('reuses builder across multiple calls', () => {
      const builder = toPagedResponseBuilder<TestItem>(25);

      const result1 = builder({
        items: [{ id: 1, name: 'Item 1' }],
        totalItems: 100,
        page: 1,
      });

      const result2 = builder({
        items: [{ id: 2, name: 'Item 2' }],
        totalItems: 100,
        page: 2,
      });

      expect(result1.page).toBe(1);
      expect(result1.totalPages).toBe(4);

      expect(result2.page).toBe(2);
      expect(result2.totalPages).toBe(4);
    });
  });

  describe('calculateTotalPages()', () => {
    it('calculates pages with remainder', () => {
      expect(calculateTotalPages(150, 20)).toBe(8);
      expect(calculateTotalPages(45, 20)).toBe(3);
      expect(calculateTotalPages(1, 20)).toBe(1);
    });

    it('calculates exact division', () => {
      expect(calculateTotalPages(40, 20)).toBe(2);
      expect(calculateTotalPages(100, 25)).toBe(4);
    });

    it('returns minimum 1 page for empty result', () => {
      expect(calculateTotalPages(0, 20)).toBe(1);
    });

    it('throws error for invalid pageSize', () => {
      expect(() => calculateTotalPages(100, 0)).toThrow('pageSize must be greater than 0');
      expect(() => calculateTotalPages(100, -10)).toThrow('pageSize must be greater than 0');
    });
  });

  describe('hasNextPage()', () => {
    it('returns true when current page < total pages', () => {
      expect(hasNextPageMeta(1, 10)).toBe(true);
      expect(hasNextPageMeta(5, 10)).toBe(true);
      expect(hasNextPageMeta(9, 10)).toBe(true);
    });

    it('returns false when on last page', () => {
      expect(hasNextPageMeta(10, 10)).toBe(false);
    });

    it('returns false when only one page', () => {
      expect(hasNextPageMeta(1, 1)).toBe(false);
    });
  });

  describe('hasPrevPage()', () => {
    it('returns true when page > 1', () => {
      expect(hasPrevPageMeta(2)).toBe(true);
      expect(hasPrevPageMeta(10)).toBe(true);
    });

    it('returns false on first page', () => {
      expect(hasPrevPageMeta(1)).toBe(false);
    });
  });

  describe('computePaginationMetadata()', () => {
    it('computes all metadata from basic info', () => {
      const meta = computePaginationMetadata(150, 2, 20);

      expect(meta.totalPages).toBe(8);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('handles first page', () => {
      const meta = computePaginationMetadata(150, 1, 20);

      expect(meta.totalPages).toBe(8);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('handles last page', () => {
      const meta = computePaginationMetadata(150, 8, 20);

      expect(meta.totalPages).toBe(8);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('handles single page', () => {
      const meta = computePaginationMetadata(5, 1, 20);

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('handles empty result', () => {
      const meta = computePaginationMetadata(0, 1, 20);

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });
  });

  describe('Type safety', () => {
    it('preserves item types in PagedResponse', () => {
      const basic = {
        items: mockItems,
        totalItems: 150,
        page: 2,
        pageSize: 20,
      };

      const result = toPagedResponse(basic);

      const firstItem: TestItem = result.items[0];
      expect(firstItem.id).toBe(1);
      expect(firstItem.name).toBe('Item 1');
    });
  });
});
