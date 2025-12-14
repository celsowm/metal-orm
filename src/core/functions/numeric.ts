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

// ----------------------
// Helper Functions
// ----------------------

/**
 * Returns the absolute value of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the ABS SQL function.
 */
export const abs = (value: OperandInput): FunctionNode => fn('ABS', [value]);

/**
 * Returns the arccosine (inverse cosine) of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the ACOS SQL function.
 */
export const acos = (value: OperandInput): FunctionNode => fn('ACOS', [value]);

/**
 * Returns the arcsine (inverse sine) of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the ASIN SQL function.
 */
export const asin = (value: OperandInput): FunctionNode => fn('ASIN', [value]);

/**
 * Returns the arctangent (inverse tangent) of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the ATAN SQL function.
 */
export const atan = (value: OperandInput): FunctionNode => fn('ATAN', [value]);

/**
 * Returns the arctangent of the two arguments.
 * @param y - The y-coordinate.
 * @param x - The x-coordinate.
 * @returns A FunctionNode representing the ATAN2 SQL function.
 */
export const atan2 = (y: OperandInput, x: OperandInput): FunctionNode => fn('ATAN2', [y, x]);

/**
 * Returns the smallest integer greater than or equal to a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the CEIL SQL function.
 */
export const ceil = (value: OperandInput): FunctionNode => fn('CEIL', [value]);

/**
 * Alias for ceil. Returns the smallest integer greater than or equal to a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the CEILING SQL function.
 */
export const ceiling = (value: OperandInput): FunctionNode => fn('CEILING', [value]);

/**
 * Returns the cosine of a number (in radians).
 * @param value - The numeric value in radians.
 * @returns A FunctionNode representing the COS SQL function.
 */
export const cos = (value: OperandInput): FunctionNode => fn('COS', [value]);

/**
 * Returns the cotangent of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the COT SQL function.
 */
export const cot = (value: OperandInput): FunctionNode => fn('COT', [value]);

/**
 * Converts radians to degrees.
 * @param value - The angle in radians.
 * @returns A FunctionNode representing the DEGREES SQL function.
 */
export const degrees = (value: OperandInput): FunctionNode => fn('DEGREES', [value]);

/**
 * Returns e raised to the power of the argument.
 * @param value - The exponent.
 * @returns A FunctionNode representing the EXP SQL function.
 */
export const exp = (value: OperandInput): FunctionNode => fn('EXP', [value]);

/**
 * Returns the largest integer less than or equal to a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the FLOOR SQL function.
 */
export const floor = (value: OperandInput): FunctionNode => fn('FLOOR', [value]);

/**
 * Returns the natural logarithm (base e) of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the LN SQL function.
 */
export const ln = (value: OperandInput): FunctionNode => fn('LN', [value]);

/**
 * Returns the base-10 logarithm of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the LOG SQL function.
 */
export const log = (value: OperandInput): FunctionNode => fn('LOG', [value]);

/**
 * Returns the base-10 logarithm of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the LOG10 SQL function.
 */
export const log10 = (value: OperandInput): FunctionNode => fn('LOG10', [value]);

/**
 * Returns the logarithm of a number for a specific base.
 * @param base - The base of the logarithm.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the LOG_BASE SQL function.
 */
export const logBase = (base: OperandInput, value: OperandInput): FunctionNode => fn('LOG_BASE', [base, value]);

/**
 * Returns the remainder of dividing x by y.
 * @param x - The dividend.
 * @param y - The divisor.
 * @returns A FunctionNode representing the MOD SQL function.
 */
export const mod = (x: OperandInput, y: OperandInput): FunctionNode => fn('MOD', [x, y]);

/**
 * Returns the value of PI (approximately 3.14159...).
 * @returns A FunctionNode representing the PI SQL function.
 */
export const pi = (): FunctionNode => fn('PI', []);

/**
 * Returns x raised to the power of y.
 * @param x - The base.
 * @param y - The exponent.
 * @returns A FunctionNode representing the POWER SQL function.
 */
export const power = (x: OperandInput, y: OperandInput): FunctionNode => fn('POWER', [x, y]);

/**
 * Alias for power. Returns x raised to the power of y.
 * @param x - The base.
 * @param y - The exponent.
 * @returns A FunctionNode representing the POW SQL function.
 */
export const pow = (x: OperandInput, y: OperandInput): FunctionNode => fn('POW', [x, y]);

/**
 * Converts degrees to radians.
 * @param value - The angle in degrees.
 * @returns A FunctionNode representing the RADIANS SQL function.
 */
export const radians = (value: OperandInput): FunctionNode => fn('RADIANS', [value]);

/**
 * Returns a random number between 0 and 1.
 * @returns A FunctionNode representing the RANDOM SQL function.
 */
export const random = (): FunctionNode => fn('RANDOM', []);

/**
 * Alias for random. Returns a random number between 0 and 1.
 * @returns A FunctionNode representing the RAND SQL function.
 */
export const rand = (): FunctionNode => fn('RAND', []);

/**
 * Rounds a number to a specified number of decimal places.
 * @param value - The numeric value to round.
 * @param decimals - The number of decimal places (optional).
 * @returns A FunctionNode representing the ROUND SQL function.
 */
export const round = (value: OperandInput, decimals?: OperandInput): FunctionNode =>
    decimals === undefined ? fn('ROUND', [value]) : fn('ROUND', [value, decimals]);

/**
 * Returns the sign of a number (-1 for negative, 0 for zero, 1 for positive).
 * @param value - The numeric value.
 * @returns A FunctionNode representing the SIGN SQL function.
 */
export const sign = (value: OperandInput): FunctionNode => fn('SIGN', [value]);

/**
 * Returns the sine of a number (in radians).
 * @param value - The numeric value in radians.
 * @returns A FunctionNode representing the SIN SQL function.
 */
export const sin = (value: OperandInput): FunctionNode => fn('SIN', [value]);

/**
 * Returns the square root of a number.
 * @param value - The numeric value.
 * @returns A FunctionNode representing the SQRT SQL function.
 */
export const sqrt = (value: OperandInput): FunctionNode => fn('SQRT', [value]);

/**
 * Returns the tangent of a number (in radians).
 * @param value - The numeric value in radians.
 * @returns A FunctionNode representing the TAN SQL function.
 */
export const tan = (value: OperandInput): FunctionNode => fn('TAN', [value]);

/**
 * Truncates a number to a specified number of decimal places without rounding.
 * @param value - The numeric value to truncate.
 * @param decimals - The number of decimal places (optional).
 * @returns A FunctionNode representing the TRUNC SQL function.
 */
export const trunc = (value: OperandInput, decimals?: OperandInput): FunctionNode =>
    decimals === undefined ? fn('TRUNC', [value]) : fn('TRUNC', [value, decimals]);

/**
 * Alias for trunc. Truncates a number to a specified number of decimal places without rounding.
 * @param value - The numeric value to truncate.
 * @param decimals - The number of decimal places.
 * @returns A FunctionNode representing the TRUNCATE SQL function.
 */
export const truncate = (value: OperandInput, decimals: OperandInput): FunctionNode =>
    fn('TRUNCATE', [value, decimals]);
