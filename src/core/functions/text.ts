// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode } from '../ast/expression.js';

type OperandInput = OperandNode | ColumnDef | string | number | boolean | null;

const isColumnDef = (val: any): val is ColumnDef => !!val && typeof val === 'object' && 'type' in val && 'name' in val;

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
 * Helper: LOWER(str)
 */
export const lower = (value: OperandInput): FunctionNode => fn('LOWER', [value]);

/**
 * Helper: UPPER(str)
 */
export const upper = (value: OperandInput): FunctionNode => fn('UPPER', [value]);

/**
 * Helper: ASCII(str)
 */
export const ascii = (value: OperandInput): FunctionNode => fn('ASCII', [value]);

/**
 * Helper: CHAR(code[, code...])
 */
export const char = (...codes: OperandInput[]): FunctionNode => {
  if (codes.length === 0) throw new Error('char() expects at least 1 argument');
  return fn('CHAR', codes);
};

/**
 * Helper: CHAR_LENGTH(str)
 */
export const charLength = (value: OperandInput): FunctionNode => fn('CHAR_LENGTH', [value]);

/**
 * Helper: LENGTH(str)
 */
export const length = (value: OperandInput): FunctionNode => fn('LENGTH', [value]);

/**
 * Helper: TRIM([chars FROM] str)
 */
export const trim = (value: OperandInput, chars?: OperandInput): FunctionNode =>
  chars === undefined ? fn('TRIM', [value]) : fn('TRIM', [value, chars]);

/**
 * Helper: LTRIM(str)
 */
export const ltrim = (value: OperandInput): FunctionNode => fn('LTRIM', [value]);

/**
 * Helper: RTRIM(str)
 */
export const rtrim = (value: OperandInput): FunctionNode => fn('RTRIM', [value]);

/**
 * Helper: CONCAT(arg1, arg2, ...)
 */
export const concat = (...args: OperandInput[]): FunctionNode => {
  if (args.length < 2) throw new Error('concat() expects at least 2 arguments');
  return fn('CONCAT', args);
};

/**
 * Helper: CONCAT_WS(separator, arg1, arg2, ...)
 */
export const concatWs = (separator: OperandInput, ...args: OperandInput[]): FunctionNode => {
  if (args.length < 1) throw new Error('concatWs() expects at least 2 arguments including the separator');
  return fn('CONCAT_WS', [separator, ...args]);
};

/**
 * Helper: SUBSTR(str, start[, length])
 */
export const substr = (value: OperandInput, start: OperandInput, length?: OperandInput): FunctionNode =>
  length === undefined ? fn('SUBSTR', [value, start]) : fn('SUBSTR', [value, start, length]);

/**
 * Helper: LEFT(str, length)
 */
export const left = (value: OperandInput, len: OperandInput): FunctionNode => fn('LEFT', [value, len]);

/**
 * Helper: RIGHT(str, length)
 */
export const right = (value: OperandInput, len: OperandInput): FunctionNode => fn('RIGHT', [value, len]);

/**
 * Helper: POSITION(substring IN string)
 */
export const position = (substring: OperandInput, value: OperandInput): FunctionNode => fn('POSITION', [substring, value]);

/**
 * Helper: INSTR(string, substring)
 */
export const instr = (value: OperandInput, substring: OperandInput): FunctionNode => fn('INSTR', [value, substring]);

/**
 * Helper: LOCATE(substring, string[, start])
 */
export const locate = (substring: OperandInput, value: OperandInput, start?: OperandInput): FunctionNode =>
  start === undefined ? fn('LOCATE', [substring, value]) : fn('LOCATE', [substring, value, start]);

/**
 * Helper: REPLACE(string, search, replace)
 */
export const replace = (value: OperandInput, search: OperandInput, replacement: OperandInput): FunctionNode =>
  fn('REPLACE', [value, search, replacement]);

/**
 * Helper: REPEAT(string, count)
 */
export const repeat = (value: OperandInput, count: OperandInput): FunctionNode => fn('REPEAT', [value, count]);

/**
 * Helper: LPAD(string, length, padstr)
 */
export const lpad = (value: OperandInput, len: OperandInput, pad: OperandInput): FunctionNode =>
  fn('LPAD', [value, len, pad]);

/**
 * Helper: RPAD(string, length, padstr)
 */
export const rpad = (value: OperandInput, len: OperandInput, pad: OperandInput): FunctionNode =>
  fn('RPAD', [value, len, pad]);

/**
 * Helper: SPACE(count)
 */
export const space = (count: OperandInput): FunctionNode => fn('SPACE', [count]);
