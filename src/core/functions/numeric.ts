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

const nfn = (key: string, args: OperandInput[]): TypedExpression<number> => asType<number>(fn(key, args));

// ----------------------
// Helper Functions
// ----------------------

/**
 * Returns the absolute value of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `ABS` SQL function.
 * 
 * @example
 * abs(transactions.amount);
 */
export const abs = (value: OperandInput): TypedExpression<number> => nfn('ABS', [value]);

/**
 * Returns the arccosine (inverse cosine) of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `ACOS` SQL function.
 */
export const acos = (value: OperandInput): TypedExpression<number> => nfn('ACOS', [value]);

/**
 * Returns the arcsine (inverse sine) of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `ASIN` SQL function.
 */
export const asin = (value: OperandInput): TypedExpression<number> => nfn('ASIN', [value]);

/**
 * Returns the arctangent (inverse tangent) of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `ATAN` SQL function.
 */
export const atan = (value: OperandInput): TypedExpression<number> => nfn('ATAN', [value]);

/**
 * Returns the arctangent of the two arguments.
 * 
 * @param y - The y-coordinate.
 * @param x - The x-coordinate.
 * @returns A `TypedExpression<number>` representing the `ATAN2` SQL function.
 */
export const atan2 = (y: OperandInput, x: OperandInput): TypedExpression<number> => nfn('ATAN2', [y, x]);

/**
 * Returns the smallest integer greater than or equal to a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `CEIL` SQL function.
 */
export const ceil = (value: OperandInput): TypedExpression<number> => nfn('CEIL', [value]);

/**
 * Alias for ceil. Returns the smallest integer greater than or equal to a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `CEILING` SQL function.
 */
export const ceiling = (value: OperandInput): TypedExpression<number> => nfn('CEILING', [value]);

/**
 * Returns the cosine of a number (in radians).
 * 
 * @param value - The numeric value in radians.
 * @returns A `TypedExpression<number>` representing the `COS` SQL function.
 */
export const cos = (value: OperandInput): TypedExpression<number> => nfn('COS', [value]);

/**
 * Returns the cotangent of a number.
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `COT` SQL function.
 */
export const cot = (value: OperandInput): TypedExpression<number> => nfn('COT', [value]);

/**
 * Converts radians to degrees.
 * 
 * @param value - The angle in radians.
 * @returns A `TypedExpression<number>` representing the `DEGREES` SQL function.
 */
export const degrees = (value: OperandInput): TypedExpression<number> => nfn('DEGREES', [value]);

/**
 * Returns e raised to the power of the argument.
 * 
 * @param value - The exponent.
 * @returns A `TypedExpression<number>` representing the `EXP` SQL function.
 */
export const exp = (value: OperandInput): TypedExpression<number> => nfn('EXP', [value]);

/**
 * Returns the largest integer less than or equal to a number.
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `FLOOR` SQL function.
 */
export const floor = (value: OperandInput): TypedExpression<number> => nfn('FLOOR', [value]);

/**
 * Returns the natural logarithm (base e) of a number.
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `LN` SQL function.
 */
export const ln = (value: OperandInput): TypedExpression<number> => nfn('LN', [value]);

/**
 * Returns the base-10 logarithm of a number.
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `LOG` SQL function.
 */
export const log = (value: OperandInput): TypedExpression<number> => nfn('LOG', [value]);

/**
 * Returns the base-10 logarithm of a number.
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `LOG10` SQL function.
 */
export const log10 = (value: OperandInput): TypedExpression<number> => nfn('LOG10', [value]);

/**
 * Returns the logarithm of a number for a specific base.
 * 
 * @param base - The base of the logarithm.
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `LOG_BASE` SQL function.
 */
export const logBase = (base: OperandInput, value: OperandInput): TypedExpression<number> => nfn('LOG_BASE', [base, value]);

/**
 * Returns the remainder of dividing x by y.
 * 
 * @param x - The dividend.
 * @param y - The divisor.
 * @returns A `TypedExpression<number>` representing the `MOD` SQL function.
 */
export const mod = (x: OperandInput, y: OperandInput): TypedExpression<number> => nfn('MOD', [x, y]);

/**
 * Returns the value of PI (approximately 3.14159...).
 * 
 * @returns A `TypedExpression<number>` representing the `PI` SQL function.
 */
export const pi = (): TypedExpression<number> => nfn('PI', []);

/**
 * Returns x raised to the power of y.
 * 
 * @param x - The base.
 * @param y - The exponent.
 * @returns A `TypedExpression<number>` representing the `POWER` SQL function.
 */
export const power = (x: OperandInput, y: OperandInput): TypedExpression<number> => nfn('POWER', [x, y]);

/**
 * Alias for power. Returns x raised to the power of y.
 * 
 * @param x - The base.
 * @param y - The exponent.
 * @returns A `TypedExpression<number>` representing the `POW` SQL function.
 */
export const pow = (x: OperandInput, y: OperandInput): TypedExpression<number> => nfn('POW', [x, y]);

/**
 * Converts degrees to radians.
 * 
 * @param value - The angle in degrees.
 * @returns A `TypedExpression<number>` representing the `RADIANS` SQL function.
 */
export const radians = (value: OperandInput): TypedExpression<number> => nfn('RADIANS', [value]);

/**
 * Returns a random number between 0 and 1.
 * 
 * @returns A `TypedExpression<number>` representing the `RANDOM` SQL function.
 */
export const random = (): TypedExpression<number> => nfn('RANDOM', []);

/**
 * Alias for random. Returns a random number between 0 and 1.
 * 
 * @returns A `TypedExpression<number>` representing the `RAND` SQL function.
 */
export const rand = (): TypedExpression<number> => nfn('RAND', []);

/**
 * Rounds a number to a specified number of decimal places.
 * 
 * @param value - The numeric value to round.
 * @param decimals - Optional number of decimal places.
 * @returns A `TypedExpression<number>` representing the `ROUND` SQL function.
 */
export const round = (value: OperandInput, decimals?: OperandInput): TypedExpression<number> =>
    decimals === undefined ? nfn('ROUND', [value]) : nfn('ROUND', [value, decimals]);

/**
 * Returns the sign of a number (-1 for negative, 0 for zero, 1 for positive).
 * 
 * @param value - The numeric value.
 * @returns A `TypedExpression<number>` representing the `SIGN` SQL function.
 */
export const sign = (value: OperandInput): TypedExpression<number> => nfn('SIGN', [value]);

/**
 * Returns the sine of a number (in radians).
 * 
 * @param value - The numeric value in radians.
 * @returns A `TypedExpression<number>` representing the `SIN` SQL function.
 */
export const sin = (value: OperandInput): TypedExpression<number> => nfn('SIN', [value]);

/**
 * Returns the square root of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `SQRT` SQL function.
 */
export const sqrt = (value: OperandInput): TypedExpression<number> => nfn('SQRT', [value]);

/**
 * Returns the tangent of a number (in radians).
 * 
 * @param value - The numeric value in radians.
 * @returns A `TypedExpression<number>` representing the `TAN` SQL function.
 */
export const tan = (value: OperandInput): TypedExpression<number> => nfn('TAN', [value]);

/**
 * Truncates a number to a specified number of decimal places without rounding.
 * 
 * @param value - The numeric value to truncate.
 * @param decimals - Optional number of decimal places.
 * @returns A `TypedExpression<number>` representing the `TRUNC` SQL function.
 */
export const trunc = (value: OperandInput, decimals?: OperandInput): TypedExpression<number> =>
    decimals === undefined ? nfn('TRUNC', [value]) : nfn('TRUNC', [value, decimals]);

/**
 * Alias for trunc. Truncates a number to a specified number of decimal places without rounding.
 * 
 * @param value - The numeric value to truncate.
 * @param decimals - The number of decimal places.
 * @returns A `TypedExpression<number>` representing the `TRUNCATE` SQL function.
 */
export const truncate = (value: OperandInput, decimals: OperandInput): TypedExpression<number> =>
    nfn('TRUNCATE', [value, decimals]);

/**
 * Returns the base-2 logarithm of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `LOG2` SQL function.
 */
export const log2 = (value: OperandInput): TypedExpression<number> => nfn('LOG2', [value]);

/**
 * Returns the cube root of a number.
 * 
 * @param value - The numeric value or column.
 * @returns A `TypedExpression<number>` representing the `CBRT` SQL function.
 */
export const cbrt = (value: OperandInput): TypedExpression<number> => nfn('CBRT', [value]);

