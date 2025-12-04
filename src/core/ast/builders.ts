import { ColumnDef } from '../../schema/column.js';
import { TableDef } from '../../schema/table.js';
import { ColumnNode } from './expression-nodes.js';
import { TableNode } from './query.js';

/**
 * Builds or normalizes a column AST node from a column definition or existing node
 * @param table - Table definition providing a default table name
 * @param column - Column definition or existing column node
 */
export const buildColumnNode = (table: TableDef, column: ColumnDef | ColumnNode): ColumnNode => {
  if ((column as ColumnNode).type === 'Column') {
    return column as ColumnNode;
  }

  const def = column as ColumnDef;
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
export const buildColumnNodes = (table: TableDef, names: string[]): ColumnNode[] =>
  names.map(name => ({
    type: 'Column',
    table: table.name,
    name
  }));

/**
 * Builds a table AST node for the provided table definition
 * @param table - Table definition
 */
export const createTableNode = (table: TableDef): TableNode => ({
  type: 'Table',
  name: table.name
});
