// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column-types.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode, TypedExpression, asType } from '../ast/expression.js';

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

const sfn = (key: string, args: OperandInput[]): TypedExpression<string> => asType<string>(fn(key, args));
const nfn = (key: string, args: OperandInput[]): TypedExpression<number> => asType<number>(fn(key, args));

/**
 * Converts a string to lowercase.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `LOWER` SQL function.
 * 
 * @example
 * lower(users.email);
 */
export const lower = (value: OperandInput): TypedExpression<string> => sfn('LOWER', [value]);

/**
 * Converts a string to uppercase.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `UPPER` SQL function.
 * 
 * @example
 * upper(users.firstName);
 */
export const upper = (value: OperandInput): TypedExpression<string> => sfn('UPPER', [value]);

/**
 * Returns the ASCII code of the first character of a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<number>` representing the `ASCII` SQL function.
 * 
 * @example
 * ascii(users.initial);
 */
export const ascii = (value: OperandInput): TypedExpression<number> => nfn('ASCII', [value]);

/**
 * Returns a string from one or more ASCII codes.
 * 
 * @param codes - One or more ASCII codes.
 * @returns A `TypedExpression<string>` representing the `CHAR` SQL function.
 * 
 * @example
 * char(65, 66, 67); // 'ABC'
 */
export const char = (...codes: OperandInput[]): TypedExpression<string> => {
  if (codes.length === 0) throw new Error('char() expects at least 1 argument');
  return sfn('CHAR', codes);
};

/**
 * Returns the number of characters in a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<number>` representing the `CHAR_LENGTH` SQL function.
 * 
 * @example
 * charLength(users.bio);
 */
export const charLength = (value: OperandInput): TypedExpression<number> => nfn('CHAR_LENGTH', [value]);

/**
 * Returns the length of a string in bytes or characters.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<number>` representing the `LENGTH` SQL function.
 * 
 * @example
 * length(users.password);
 */
export const length = (value: OperandInput): TypedExpression<number> => nfn('LENGTH', [value]);

/**
 * Removes leading and trailing whitespace or specified characters from a string.
 * 
 * @param value - The string value or column.
 * @param chars - Optional characters to trim.
 * @returns A `TypedExpression<string>` representing the `TRIM` SQL function.
 * 
 * @example
 * trim(users.name);
 * trim(users.path, '/');
 */
export const trim = (value: OperandInput, chars?: OperandInput): TypedExpression<string> =>
  chars === undefined ? sfn('TRIM', [value]) : sfn('TRIM', [value, chars]);

/**
 * Removes leading whitespace from a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `LTRIM` SQL function.
 */
export const ltrim = (value: OperandInput): TypedExpression<string> => sfn('LTRIM', [value]);

/**
 * Removes trailing whitespace from a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `RTRIM` SQL function.
 */
export const rtrim = (value: OperandInput): TypedExpression<string> => sfn('RTRIM', [value]);

/**
 * Concatenates two or more strings.
 * 
 * @param args - The strings or columns to concatenate.
 * @returns A `TypedExpression<string>` representing the `CONCAT` SQL function.
 * 
 * @example
 * concat(users.firstName, ' ', users.lastName);
 */
export const concat = (...args: OperandInput[]): TypedExpression<string> => {
  if (args.length < 2) throw new Error('concat() expects at least 2 arguments');
  return sfn('CONCAT', args);
};

/**
 * Concatenates strings with a separator.
 * 
 * @param separator - The separator string.
 * @param args - The strings or columns to concatenate.
 * @returns A `TypedExpression<string>` representing the `CONCAT_WS` SQL function.
 * 
 * @example
 * concatWs(', ', users.lastName, users.firstName);
 */
export const concatWs = (separator: OperandInput, ...args: OperandInput[]): TypedExpression<string> => {
  if (args.length < 1) throw new Error('concatWs() expects at least 2 arguments including the separator');
  return sfn('CONCAT_WS', [separator, ...args]);
};

/**
 * Extracts a substring from a string.
 * 
 * @param value - The input string or column.
 * @param start - The starting position (1-indexed).
 * @param length - Optional length of the substring.
 * @returns A `TypedExpression<string>` representing the `SUBSTR` SQL function.
 * 
 * @example
 * substr(users.token, 1, 8);
 */
export const substr = (value: OperandInput, start: OperandInput, length?: OperandInput): TypedExpression<string> =>
  length === undefined ? sfn('SUBSTR', [value, start]) : sfn('SUBSTR', [value, start, length]);

/**
 * Returns the leftmost characters of a string.
 * 
 * @param value - The string value or column.
 * @param len - Number of characters to return.
 * @returns A `TypedExpression<string>` representing the `LEFT` SQL function.
 */
export const left = (value: OperandInput, len: OperandInput): TypedExpression<string> => sfn('LEFT', [value, len]);

/**
 * Returns the rightmost characters of a string.
 * 
 * @param value - The string value or column.
 * @param len - Number of characters to return.
 * @returns A `TypedExpression<string>` representing the `RIGHT` SQL function.
 */
export const right = (value: OperandInput, len: OperandInput): TypedExpression<string> => sfn('RIGHT', [value, len]);

/**
 * Returns the position of a substring in a string.
 * 
 * @param substring - The substring to search for.
 * @param value - The string or column to search within.
 * @returns A `TypedExpression<number>` representing the `POSITION` SQL function.
 */
export const position = (substring: OperandInput, value: OperandInput): TypedExpression<number> => nfn('POSITION', [substring, value]);

/**
 * Returns the position of a substring in a string.
 * 
 * @param value - The string or column to search within.
 * @param substring - The substring to search for.
 * @returns A `TypedExpression<number>` representing the `INSTR` SQL function.
 */
export const instr = (value: OperandInput, substring: OperandInput): TypedExpression<number> => nfn('INSTR', [value, substring]);

/**
 * Returns the position of a substring in a string, optionally starting from a position.
 * 
 * @param substring - Substring to find.
 * @param value - String/column to search.
 * @param start - Optional starting position.
 * @returns A `TypedExpression<number>` representing the `LOCATE` SQL function.
 */
export const locate = (substring: OperandInput, value: OperandInput, start?: OperandInput): TypedExpression<number> =>
  start === undefined ? nfn('LOCATE', [substring, value]) : nfn('LOCATE', [substring, value, start]);

/**
 * Replaces occurrences of a substring in a string.
 * 
 * @param value - The original string or column.
 * @param search - Substring to search for.
 * @param replacement - Replacement string.
 * @returns A `TypedExpression<string>` representing the `REPLACE` SQL function.
 * 
 * @example
 * replace(users.email, 'old.com', 'new.com');
 */
export const replace = (value: OperandInput, search: OperandInput, replacement: OperandInput): TypedExpression<string> =>
  sfn('REPLACE', [value, search, replacement]);

/**
 * Repeats a string a specified number of times.
 * 
 * @param value - The string to repeat.
 * @param count - How many times to repeat.
 * @returns A `TypedExpression<string>` representing the `REPEAT` SQL function.
 */
export const repeat = (value: OperandInput, count: OperandInput): TypedExpression<string> => sfn('REPEAT', [value, count]);

/**
 * Left-pads a string to a certain length with another string.
 * 
 * @param value - The string/column to pad.
 * @param len - Target length.
 * @param pad - Padding string.
 * @returns A `TypedExpression<string>` representing the `LPAD` SQL function.
 */
export const lpad = (value: OperandInput, len: OperandInput, pad: OperandInput): TypedExpression<string> =>
  sfn('LPAD', [value, len, pad]);

/**
 * Right-pads a string to a certain length with another string.
 * 
 * @param value - The string/column to pad.
 * @param len - Target length.
 * @param pad - Padding string.
 * @returns A `TypedExpression<string>` representing the `RPAD` SQL function.
 */
export const rpad = (value: OperandInput, len: OperandInput, pad: OperandInput): TypedExpression<string> =>
  sfn('RPAD', [value, len, pad]);

/**
 * Returns a string consisting of a specified number of spaces.
 * 
 * @param count - Number of spaces.
 * @returns A `TypedExpression<string>` representing the `SPACE` SQL function.
 */
export const space = (count: OperandInput): TypedExpression<string> => sfn('SPACE', [count]);

/**
 * Reverses a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `REVERSE` SQL function.
 */
export const reverse = (value: OperandInput): TypedExpression<string> => sfn('REVERSE', [value]);

/**
 * Capitalizes the first letter of each word in a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `INITCAP` SQL function.
 */
export const initcap = (value: OperandInput): TypedExpression<string> => sfn('INITCAP', [value]);

/**
 * Returns the MD5 hash of a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `MD5` SQL function.
 */
export const md5 = (value: OperandInput): TypedExpression<string> => sfn('MD5', [value]);

/**
 * Returns the SHA-1 hash of a string.
 * 
 * @param value - The string value or column.
 * @returns A `TypedExpression<string>` representing the `SHA1` SQL function.
 */
export const sha1 = (value: OperandInput): TypedExpression<string> => sfn('SHA1', [value]);

/**
 * Returns the SHA-2 hash of a string with a specified bit length.
 * 
 * @param value - The input.
 * @param bits - Bit length (e.g., 256, 512).
 * @returns A `TypedExpression<string>` representing the `SHA2` SQL function.
 */
export const sha2 = (value: OperandInput, bits: OperandInput): TypedExpression<string> => sfn('SHA2', [value, bits]);

/**
 * Returns the length of a string in bits.
 * 
 * @param value - String value or column.
 * @returns A `TypedExpression<number>` representing the `BIT_LENGTH` SQL function.
 */
export const bitLength = (value: OperandInput): TypedExpression<number> => nfn('BIT_LENGTH', [value]);

/**
 * Returns the length of a string in bytes.
 * 
 * @param value - String value or column.
 * @returns A `TypedExpression<number>` representing the `OCTET_LENGTH` SQL function.
 */
export const octetLength = (value: OperandInput): TypedExpression<number> => nfn('OCTET_LENGTH', [value]);

/**
 * Returns a string from an ASCII code.
 * 
 * @param code - ASCII code.
 * @returns A `TypedExpression<string>` representing the `CHR` SQL function.
 */
export const chr = (code: OperandInput): TypedExpression<string> => sfn('CHR', [code]);

