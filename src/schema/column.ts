/**
 * Supported column data types for database schema definitions
 */
export type ColumnType = 'INT' | 'VARCHAR' | 'JSON' | 'ENUM' | 'BOOLEAN';

/**
 * Definition of a database column
 */
export interface ColumnDef {
  /** Column name (filled at runtime by defineTable) */
  name: string;
  /** Data type of the column */
  type: ColumnType;
  /** Whether this column is a primary key */
  primary?: boolean;
  /** Whether this column cannot be null */
  notNull?: boolean;
  /** Additional arguments for the column type (e.g., VARCHAR length) */
  args?: any[];
  /** Table name this column belongs to (filled at runtime by defineTable) */
  table?: string;
}

/**
 * Factory for creating column definitions with common data types
 */
export const col = {
  /**
   * Creates an integer column definition
   * @returns ColumnDef with INT type
   */
  int: (): ColumnDef => ({ name: '', type: 'INT' }),

  /**
   * Creates a variable character column definition
   * @param length - Maximum length of the string
   * @returns ColumnDef with VARCHAR type
   */
  varchar: (length: number): ColumnDef => ({ name: '', type: 'VARCHAR', args: [length] }),

  /**
   * Creates a JSON column definition
   * @returns ColumnDef with JSON type
   */
  json: (): ColumnDef => ({ name: '', type: 'JSON' }),

  /**
   * Creates a boolean column definition
   * @returns ColumnDef with BOOLEAN type
   */
  boolean: (): ColumnDef => ({ name: '', type: 'BOOLEAN' }),

  /**
   * Marks a column definition as a primary key
   * @param def - Column definition to modify
   * @returns Modified ColumnDef with primary: true
   */
  primaryKey: (def: ColumnDef): ColumnDef => ({ ...def, primary: true })
};
