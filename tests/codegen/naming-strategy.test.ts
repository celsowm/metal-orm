import { describe, it, expect } from 'vitest';
import { DefaultNamingStrategy } from '../../src/codegen/naming-strategy.js';
import { ColumnNode } from '../../src/core/ast/expression.js';

describe('NamingStrategy', () => {
  const strategy = new DefaultNamingStrategy();

  describe('tableToSymbol', () => {
    it('should capitalize simple table names', () => {
      expect(strategy.tableToSymbol('users')).toBe('Users');
      expect(strategy.tableToSymbol('orders')).toBe('Orders');
    });

    it('should handle schema-qualified table names', () => {
      expect(strategy.tableToSymbol('auth.users')).toBe('AuthUsers');
      expect(strategy.tableToSymbol('public.orders')).toBe('PublicOrders');
    });

    it('should handle table nodes', () => {
      const tableNode = { type: 'Table', name: 'users' } as const;
      expect(strategy.tableToSymbol(tableNode)).toBe('Users');
    });

    it('should handle function table nodes', () => {
      const functionTableNode = { type: 'FunctionTable', name: 'generate_series' } as const;
      expect(strategy.tableToSymbol(functionTableNode)).toBe('Generate_series');
    });
  });

  describe('columnToProperty', () => {
    it('should return column name as-is', () => {
      const columnNode: ColumnNode = {
        type: 'Column',
        table: 'users',
        name: 'user_name'
      };
      expect(strategy.columnToProperty(columnNode)).toBe('user_name');
    });
  });
});
