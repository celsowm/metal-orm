import { ColumnNode } from './expression-nodes.js';
import { TableNode, FunctionTableNode } from './query.js';
import { ColumnRef, TableRef } from './types.js';

/**
 * Builds or normalizes a column AST node from a column definition or existing node
 * @param table - Table definition providing a default table name
 * @param column - Column definition or existing column node
 */
export const buildColumnNode = (table: TableRef, column: ColumnRef | ColumnNode): ColumnNode => {
  if ((column as ColumnNode).type === 'Column') {
    return column as ColumnNode;
  }

  const def = column as ColumnRef;
  return {
    type: 'Column',
    table: def.table || table.name,
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
    table: table.name,
    name
  }));

/**
 * Builds a table AST node for the provided table definition
 * @param table - Table definition
 */
export const createTableNode = (table: TableRef): TableNode => ({
  type: 'Table',
  name: table.name
});

/**
 * Creates a FunctionTable node for expressions like `function_name(args...)` used in FROM
 */
export const fnTable = (name: string, args: any[] = [], alias?: string, opts?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }): FunctionTableNode => ({
  type: 'FunctionTable',
  name,
  args,
  alias,
  lateral: opts?.lateral,
  withOrdinality: opts?.withOrdinality,
  columnAliases: opts?.columnAliases,
  schema: opts?.schema
});
