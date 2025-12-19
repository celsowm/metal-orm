import type { TableNode, FunctionTableNode, DerivedTableNode, TableSourceNode } from '../core/ast/query.js';
import type { ColumnNode } from '../core/ast/expression.js';

/**
 * Strategy interface for converting database names to TypeScript identifiers
 */
export interface NamingStrategy {
  /**
   * Converts a table name to a TypeScript symbol name
   * @param table - Table node, function table node, or name
   * @returns Valid TypeScript identifier
   */
  tableToSymbol(table: TableSourceNode | string): string;

  /**
   * Converts a column reference to a property name
   * @param column - Column node
   * @returns Valid TypeScript property name
   */
  columnToProperty(column: ColumnNode): string;
}

/**
 * Default naming strategy that maintains backward compatibility
 * with the original capitalize() behavior
 */
export class DefaultNamingStrategy implements NamingStrategy {
  /**
   * Converts table names to TypeScript symbols
   * @param table - Table node, function table node, or string name
   * @returns Capitalized table name (handles schema-qualified names)
   */
  tableToSymbol(table: TableNode | FunctionTableNode | DerivedTableNode | string): string {
    const tableName =
      typeof table === 'string'
        ? table
        : table.type === 'DerivedTable'
          ? table.alias
          : table.type === 'FunctionTable'
            ? table.alias ?? table.name
            : table.name;

    // Handle schema-qualified names (e.g., "auth.user" → "AuthUser")
    if (tableName.includes('.')) {
      return tableName.split('.')
        .map(part => this.capitalize(part))
        .join('');
    }

    return this.capitalize(tableName);
  }

  /**
   * Converts column references to property names
   * @param column - Column node
   * @returns Column name as-is (for backward compatibility)
   */
  columnToProperty(column: ColumnNode): string {
    return column.name;
  }

  /**
   * Capitalizes the first letter of a string
   * @param s - String to capitalize
   * @returns Capitalized string
   */
  private capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
