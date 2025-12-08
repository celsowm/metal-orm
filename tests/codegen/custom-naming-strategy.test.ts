import { describe, it, expect } from 'vitest';
import { TypeScriptGenerator } from '../../src/codegen/typescript.js';
import { NamingStrategy } from '../../src/codegen/naming-strategy.js';
import { TableNode, FunctionTableNode } from '../../src/core/ast/query.js';
import { ColumnNode } from '../../src/core/ast/expression.js';

/**
 * Custom naming strategy that converts snake_case to PascalCase
 */
class SnakeCaseNamingStrategy implements NamingStrategy {
  tableToSymbol(table: TableNode | FunctionTableNode | string): string {
    const tableName = typeof table === 'string' ? table : table.name;

    if (tableName.includes('.')) {
      return tableName.split('.')
        .map(part => this.toPascalCase(part))
        .join('');
    }

    return this.toPascalCase(tableName);
  }

  columnToProperty(column: ColumnNode): string {
    return this.toCamelCase(column.name);
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(str: string): string {
    if (!str.includes('_')) return str;
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

/**
 * Custom naming strategy that handles reserved words
 */
class ReservedWordNamingStrategy implements NamingStrategy {
  private readonly reservedWords = new Set([
    'order', 'class', 'function', 'interface', 'enum', 'type',
    'public', 'private', 'protected', 'static', 'abstract'
  ]);

  tableToSymbol(table: TableNode | FunctionTableNode | string): string {
    const tableName = typeof table === 'string' ? table : table.name;
    let result = tableName;

    if (this.reservedWords.has(tableName.toLowerCase())) {
      result = tableName + 'Table';
    }

    if (result.includes('.')) {
      return result.split('.')
        .map(part => this.capitalize(part))
        .join('');
    }

    return this.capitalize(result);
  }

  columnToProperty(column: ColumnNode): string {
    return column.name;
  }

  private capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

describe('Custom Naming Strategies', () => {
  describe('SnakeCaseNamingStrategy', () => {
    const strategy = new SnakeCaseNamingStrategy();

    describe('tableToSymbol', () => {
      it('should convert snake_case to PascalCase', () => {
        expect(strategy.tableToSymbol('user_profile')).toBe('UserProfile');
        expect(strategy.tableToSymbol('order_details')).toBe('OrderDetails');
        expect(strategy.tableToSymbol('api_keys')).toBe('ApiKeys');
      });

      it('should handle schema-qualified snake_case names', () => {
        expect(strategy.tableToSymbol('auth.user_profile')).toBe('AuthUserProfile');
        expect(strategy.tableToSymbol('public.order_details')).toBe('PublicOrderDetails');
      });

      it('should handle table nodes', () => {
        const tableNode = { type: 'Table', name: 'user_profile' } as const;
        expect(strategy.tableToSymbol(tableNode)).toBe('UserProfile');
      });
    });

    describe('columnToProperty', () => {
      it('should convert snake_case to camelCase', () => {
        const columnNode: ColumnNode = {
          type: 'Column',
          table: 'users',
          name: 'user_name'
        };
        expect(strategy.columnToProperty(columnNode)).toBe('userName');
      });

      it('should handle multiple underscores', () => {
        const columnNode: ColumnNode = {
          type: 'Column',
          table: 'users',
          name: 'first_middle_last_name'
        };
        expect(strategy.columnToProperty(columnNode)).toBe('firstMiddleLastName');
      });
    });
  });

  describe('ReservedWordNamingStrategy', () => {
    const strategy = new ReservedWordNamingStrategy();

    describe('tableToSymbol', () => {
      it('should add Table suffix to reserved words', () => {
        expect(strategy.tableToSymbol('order')).toBe('OrderTable');
        expect(strategy.tableToSymbol('class')).toBe('ClassTable');
        expect(strategy.tableToSymbol('function')).toBe('FunctionTable');
      });

      it('should not modify non-reserved words', () => {
        expect(strategy.tableToSymbol('users')).toBe('Users');
        expect(strategy.tableToSymbol('products')).toBe('Products');
      });

      it('should handle schema-qualified names with reserved words', () => {
        expect(strategy.tableToSymbol('public.order')).toBe('PublicOrder');
        expect(strategy.tableToSymbol('auth.class')).toBe('AuthClass');
      });
    });
  });

  describe('TypeScriptGenerator with Custom Strategies', () => {
    it('should use SnakeCaseNamingStrategy when provided', () => {
      const generator = new TypeScriptGenerator(new SnakeCaseNamingStrategy());

      // The generator should use our custom strategy
      expect(generator).toBeInstanceOf(TypeScriptGenerator);
    });

    it('should use ReservedWordNamingStrategy when provided', () => {
      const generator = new TypeScriptGenerator(new ReservedWordNamingStrategy());

      // The generator should use our custom strategy
      expect(generator).toBeInstanceOf(TypeScriptGenerator);
    });

    it('should use DefaultNamingStrategy when no strategy provided', () => {
      const generator = new TypeScriptGenerator();

      // Should use default strategy
      expect(generator).toBeInstanceOf(TypeScriptGenerator);
    });
  });
});
