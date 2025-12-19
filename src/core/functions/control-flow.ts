// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column-types.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode } from '../ast/expression.js';

type OperandInput = OperandNode | ColumnDef | string | number | boolean | null;

const isColumnDef = (val: unknown): val is ColumnDef => !!val && typeof val === 'object' && 'type' in val && 'name' in val;

const toOperand = (input: OperandInput): OperandNode => {
  if (isOperandNode(input)) return input;
  if (isColumnDef(input)) return columnOperand(input);

  return valueToOperand(input);
};

const fn = (key: string, args: OperandInput[]): FunctionNode => ({
  type: 'Function',
  name: key,
  fn: key,
  args: args.map(toOperand)
});

/**
 * Returns the first non-null value in a list.
 * @param args - The list of values to check.
 * @returns A FunctionNode representing the COALESCE SQL function.
 */
export const coalesce = (...args: OperandInput[]): FunctionNode => {
  if (args.length < 2) throw new Error('coalesce() expects at least 2 arguments');
  return fn('COALESCE', args);
};

/**
 * Returns null if the two arguments are equal, otherwise returns the first argument.
 * @param val1 - The first value.
 * @param val2 - The second value.
 * @returns A FunctionNode representing the NULLIF SQL function.
 */
export const nullif = (val1: OperandInput, val2: OperandInput): FunctionNode => fn('NULLIF', [val1, val2]);

/**
 * Returns the largest value in a list.
 * @param args - The list of values to compare.
 * @returns A FunctionNode representing the GREATEST SQL function.
 */
export const greatest = (...args: OperandInput[]): FunctionNode => {
  if (args.length < 2) throw new Error('greatest() expects at least 2 arguments');
  return fn('GREATEST', args);
};

/**
 * Returns the smallest value in a list.
 * @param args - The list of values to compare.
 * @returns A FunctionNode representing the LEAST SQL function.
 */
export const least = (...args: OperandInput[]): FunctionNode => {
  if (args.length < 2) throw new Error('least() expects at least 2 arguments');
  return fn('LEAST', args);
};

/**
 * Returns the first argument if it is not null, otherwise returns the second argument.
 * @param val - The value to check.
 * @param defaultValue - The default value to return if val is null.
 * @returns A FunctionNode representing the COALESCE SQL function.
 */
export const ifNull = (val: OperandInput, defaultValue: OperandInput): FunctionNode => coalesce(val, defaultValue);
