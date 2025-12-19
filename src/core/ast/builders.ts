import { ColumnNode, OperandNode } from './expression-nodes.js';
import { TableNode, FunctionTableNode, DerivedTableNode } from './query.js';
import { ColumnRef, TableRef } from './types.js';

/**
 * Type guard to check if a column is already a ColumnNode
 */
const isColumnNode = (col: ColumnRef | ColumnNode): col is ColumnNode =>
  'type' in col && col.type === 'Column';

/**
 * Resolves the appropriate table name for a column reference
 * @param def - Column reference definition
 * @param table - Table reference providing context
 * @returns The resolved table name to use
 */
const resolveTableName = (def: ColumnRef, table: TableRef): string => {
  // If column doesn't specify a table, use the table's alias or name
  if (!def.table) {
    return table.alias || table.name;
  }

  // If column specifies the base table name and table has an alias, use the alias
  if (table.alias && def.table === table.name) {
    return table.alias;
  }

  // Otherwise use the table specified in the column definition
  return def.table;
};

/**
 * Builds or normalizes a column AST node from a column definition or existing node
 * @param table - Table definition providing a default table name
 * @param column - Column definition or existing column node
 */
export const buildColumnNode = (table: TableRef, column: ColumnRef | ColumnNode): ColumnNode => {
  if (isColumnNode(column)) {
    return column;
  }

  const def = column as ColumnRef;
  const baseTable = resolveTableName(def, table);

  return {
    type: 'Column',
    table: baseTable,
    name: def.name
  };
};

/**
 * Builds column AST nodes for a list of column names
 * @param table - Table definition providing the table name
 * @param names - Column names
 */
export const buildColumnNodes = (table: TableRef, names: string[]): ColumnNode[] =>
  names.map(name => ({
    type: 'Column',
    table: table.alias || table.name,
    name
  }));

/**
 * Builds a table AST node for the provided table definition
 * @param table - Table definition
 */
export const createTableNode = (table: TableRef): TableNode => ({
  type: 'Table',
  name: table.name,
  schema: (table as unknown as { schema?: string }).schema
});

/**
 * Creates a FunctionTable node for expressions like `function_name(args...)` used in FROM
 */
export const fnTable = (
  name: string,
  args: OperandNode[] = [],
  alias?: string,
  opts?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
): FunctionTableNode => ({
  type: 'FunctionTable',
  name,
  args,
  alias,
  lateral: opts?.lateral,
  withOrdinality: opts?.withOrdinality,
  columnAliases: opts?.columnAliases,
  schema: opts?.schema
});

// Dialect-aware table function (portable intent key, not a real SQL function name).
export const tvf = (
  key: string,
  args: OperandNode[] = [],
  alias?: string,
  opts?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
): FunctionTableNode => ({
  type: 'FunctionTable',
  key,
  name: key,
  args,
  alias,
  lateral: opts?.lateral,
  withOrdinality: opts?.withOrdinality,
  columnAliases: opts?.columnAliases,
  schema: opts?.schema
});

/**
 * Creates a derived table node wrapping a subquery.
 */
export const derivedTable = (
  query: import('./query.js').SelectQueryNode,
  alias: string,
  columnAliases?: string[]
): DerivedTableNode => ({
  type: 'DerivedTable',
  query,
  alias,
  columnAliases
});
