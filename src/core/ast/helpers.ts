import { ColumnNode, LiteralNode } from './expression.js';

/**
 * Creates a column node for use in expressions
 * @param table - Table name
 * @param name - Column name
 * @returns ColumnNode with the specified table and name
 */
export const createColumn = (table: string, name: string): ColumnNode => ({
    type: 'Column',
    table,
    name
});

/**
 * Creates a literal value node for use in expressions
 * @param val - Literal value
 * @returns LiteralNode with the specified value
 */
export const createLiteral = (val: LiteralNode['value']): LiteralNode => ({
    type: 'Literal',
    value: val
});
