// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column.js';
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
 * Converts a string to lowercase.
 * @param value - The string value.
 * @returns A FunctionNode representing the LOWER SQL function.
 */
export const lower = (value: OperandInput): FunctionNode => fn('LOWER', [value]);

/**
 * Converts a string to uppercase.
 * @param value - The string value.
 * @returns A FunctionNode representing the UPPER SQL function.
 */
export const upper = (value: OperandInput): FunctionNode => fn('UPPER', [value]);

/**
 * Returns the ASCII code of the first character of a string.
 * @param value - The string value.
 * @returns A FunctionNode representing the ASCII SQL function.
 */
export const ascii = (value: OperandInput): FunctionNode => fn('ASCII', [value]);

/**
 * Returns a string from one or more ASCII codes.
 * @param codes - The ASCII codes.
 * @returns A FunctionNode representing the CHAR SQL function.
 */
export const char = (...codes: OperandInput[]): FunctionNode => {
  if (codes.length === 0) throw new Error('char() expects at least 1 argument');
  return fn('CHAR', codes);
};

/**
 * Returns the number of characters in a string.
 * @param value - The string value.
 * @returns A FunctionNode representing the CHAR_LENGTH SQL function.
 */
export const charLength = (value: OperandInput): FunctionNode => fn('CHAR_LENGTH', [value]);

/**
 * Returns the length of a string in bytes or characters.
 * @param value - The string value.
 * @returns A FunctionNode representing the LENGTH SQL function.
 */
export const length = (value: OperandInput): FunctionNode => fn('LENGTH', [value]);

/**
 * Removes leading and trailing whitespace or specified characters from a string.
 * @param value - The string value.
 * @param chars - The characters to trim (optional).
 * @returns A FunctionNode representing the TRIM SQL function.
 */
export const trim = (value: OperandInput, chars?: OperandInput): FunctionNode =>
  chars === undefined ? fn('TRIM', [value]) : fn('TRIM', [value, chars]);

/**
 * Removes leading whitespace from a string.
 * @param value - The string value.
 * @returns A FunctionNode representing the LTRIM SQL function.
 */
export const ltrim = (value: OperandInput): FunctionNode => fn('LTRIM', [value]);

/**
 * Removes trailing whitespace from a string.
 * @param value - The string value.
 * @returns A FunctionNode representing the RTRIM SQL function.
 */
export const rtrim = (value: OperandInput): FunctionNode => fn('RTRIM', [value]);

/**
 * Concatenates two or more strings.
 * @param args - The strings to concatenate.
 * @returns A FunctionNode representing the CONCAT SQL function.
 */
export const concat = (...args: OperandInput[]): FunctionNode => {
  if (args.length < 2) throw new Error('concat() expects at least 2 arguments');
  return fn('CONCAT', args);
};

/**
 * Concatenates strings with a separator.
 * @param separator - The separator string.
 * @param args - The strings to concatenate.
 * @returns A FunctionNode representing the CONCAT_WS SQL function.
 */
export const concatWs = (separator: OperandInput, ...args: OperandInput[]): FunctionNode => {
  if (args.length < 1) throw new Error('concatWs() expects at least 2 arguments including the separator');
  return fn('CONCAT_WS', [separator, ...args]);
};

/**
 * Extracts a substring from a string.
 * @param value - The string value.
 * @param start - The starting position.
 * @param length - The length of the substring (optional).
 * @returns A FunctionNode representing the SUBSTR SQL function.
 */
export const substr = (value: OperandInput, start: OperandInput, length?: OperandInput): FunctionNode =>
  length === undefined ? fn('SUBSTR', [value, start]) : fn('SUBSTR', [value, start, length]);

/**
 * Returns the leftmost characters of a string.
 * @param value - The string value.
 * @param len - The number of characters to return.
 * @returns A FunctionNode representing the LEFT SQL function.
 */
export const left = (value: OperandInput, len: OperandInput): FunctionNode => fn('LEFT', [value, len]);

/**
 * Returns the rightmost characters of a string.
 * @param value - The string value.
 * @param len - The number of characters to return.
 * @returns A FunctionNode representing the RIGHT SQL function.
 */
export const right = (value: OperandInput, len: OperandInput): FunctionNode => fn('RIGHT', [value, len]);

/**
 * Returns the position of a substring in a string.
 * @param substring - The substring to search for.
 * @param value - The string to search in.
 * @returns A FunctionNode representing the POSITION SQL function.
 */
export const position = (substring: OperandInput, value: OperandInput): FunctionNode => fn('POSITION', [substring, value]);

/**
 * Returns the position of a substring in a string.
 * @param value - The string to search in.
 * @param substring - The substring to search for.
 * @returns A FunctionNode representing the INSTR SQL function.
 */
export const instr = (value: OperandInput, substring: OperandInput): FunctionNode => fn('INSTR', [value, substring]);

/**
 * Returns the position of a substring in a string, optionally starting from a position.
 * @param substring - The substring to search for.
 * @param value - The string to search in.
 * @param start - The starting position (optional).
 * @returns A FunctionNode representing the LOCATE SQL function.
 */
export const locate = (substring: OperandInput, value: OperandInput, start?: OperandInput): FunctionNode =>
  start === undefined ? fn('LOCATE', [substring, value]) : fn('LOCATE', [substring, value, start]);

/**
 * Replaces occurrences of a substring in a string.
 * @param value - The string to search in.
 * @param search - The substring to replace.
 * @param replacement - The replacement string.
 * @returns A FunctionNode representing the REPLACE SQL function.
 */
export const replace = (value: OperandInput, search: OperandInput, replacement: OperandInput): FunctionNode =>
  fn('REPLACE', [value, search, replacement]);

/**
 * Repeats a string a specified number of times.
 * @param value - The string to repeat.
 * @param count - The number of times to repeat.
 * @returns A FunctionNode representing the REPEAT SQL function.
 */
export const repeat = (value: OperandInput, count: OperandInput): FunctionNode => fn('REPEAT', [value, count]);

/**
 * Left-pads a string to a certain length with another string.
 * @param value - The string to pad.
 * @param len - The length to pad to.
 * @param pad - The padding string.
 * @returns A FunctionNode representing the LPAD SQL function.
 */
export const lpad = (value: OperandInput, len: OperandInput, pad: OperandInput): FunctionNode =>
  fn('LPAD', [value, len, pad]);

/**
 * Right-pads a string to a certain length with another string.
 * @param value - The string to pad.
 * @param len - The length to pad to.
 * @param pad - The padding string.
 * @returns A FunctionNode representing the RPAD SQL function.
 */
export const rpad = (value: OperandInput, len: OperandInput, pad: OperandInput): FunctionNode =>
  fn('RPAD', [value, len, pad]);

/**
 * Returns a string consisting of a specified number of spaces.
 * @param count - The number of spaces.
 * @returns A FunctionNode representing the SPACE SQL function.
 */
export const space = (count: OperandInput): FunctionNode => fn('SPACE', [count]);
