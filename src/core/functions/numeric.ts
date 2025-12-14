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
 * Helper: ABS(x) - Returns the absolute value of a number
 */
export const abs = (value: OperandInput): FunctionNode => fn('ABS', [value]);

/**
 * Helper: ACOS(x) - Returns the arccosine (inverse cosine)
 */
export const acos = (value: OperandInput): FunctionNode => fn('ACOS', [value]);

/**
 * Helper: ASIN(x) - Returns the arcsine (inverse sine)
 */
export const asin = (value: OperandInput): FunctionNode => fn('ASIN', [value]);

/**
 * Helper: ATAN(x) - Returns the arctangent (inverse tangent)
 */
export const atan = (value: OperandInput): FunctionNode => fn('ATAN', [value]);

/**
 * Helper: ATAN2(y, x) - Returns the arctangent of the two arguments
 */
export const atan2 = (y: OperandInput, x: OperandInput): FunctionNode => fn('ATAN2', [y, x]);

/**
 * Helper: CEIL(x) / CEILING(x) - Returns the smallest integer >= x
 */
export const ceil = (value: OperandInput): FunctionNode => fn('CEIL', [value]);

/**
 * Helper: CEILING(x) - Alias for CEIL
 */
export const ceiling = (value: OperandInput): FunctionNode => fn('CEILING', [value]);

/**
 * Helper: COS(x) - Returns the cosine of a number (in radians)
 */
export const cos = (value: OperandInput): FunctionNode => fn('COS', [value]);

/**
 * Helper: COT(x) - Returns the cotangent of a number
 */
export const cot = (value: OperandInput): FunctionNode => fn('COT', [value]);

/**
 * Helper: DEGREES(x) - Converts radians to degrees
 */
export const degrees = (value: OperandInput): FunctionNode => fn('DEGREES', [value]);

/**
 * Helper: EXP(x) - Returns e raised to the power of the argument
 */
export const exp = (value: OperandInput): FunctionNode => fn('EXP', [value]);

/**
 * Helper: FLOOR(x) - Returns the largest integer <= x
 */
export const floor = (value: OperandInput): FunctionNode => fn('FLOOR', [value]);

/**
 * Helper: LN(x) - Returns the natural logarithm (base e)
 */
export const ln = (value: OperandInput): FunctionNode => fn('LN', [value]);

/**
 * Helper: LOG(x) - Returns the base-10 logarithm
 */
export const log = (value: OperandInput): FunctionNode => fn('LOG', [value]);

/**
 * Helper: LOG10(x) - Returns the base-10 logarithm
 */
export const log10 = (value: OperandInput): FunctionNode => fn('LOG10', [value]);

/**
 * Helper: LOG(base, x) - Returns the logarithm of x for a specific base
 */
export const logBase = (base: OperandInput, value: OperandInput): FunctionNode => fn('LOG_BASE', [base, value]);

/**
 * Helper: MOD(x, y) - Returns the remainder of x/y
 */
export const mod = (x: OperandInput, y: OperandInput): FunctionNode => fn('MOD', [x, y]);

/**
 * Helper: PI() - Returns the value of PI (approx. 3.14159...)
 */
export const pi = (): FunctionNode => fn('PI', []);

/**
 * Helper: POWER(x, y) - Returns x raised to the power of y
 */
export const power = (x: OperandInput, y: OperandInput): FunctionNode => fn('POWER', [x, y]);

/**
 * Helper: POW(x, y) - Alias for POWER
 */
export const pow = (x: OperandInput, y: OperandInput): FunctionNode => fn('POW', [x, y]);

/**
 * Helper: RADIANS(x) - Converts degrees to radians
 */
export const radians = (value: OperandInput): FunctionNode => fn('RADIANS', [value]);

/**
 * Helper: RAND() / RANDOM() - Returns a random number
 */
export const random = (): FunctionNode => fn('RANDOM', []);

/**
 * Helper: RAND() - Alias for RANDOM (returns float 0-1)
 */
export const rand = (): FunctionNode => fn('RAND', []);

/**
 * Helper: ROUND(x[, decimals]) - Rounds a number to specified decimal places
 */
export const round = (value: OperandInput, decimals?: OperandInput): FunctionNode =>
    decimals === undefined ? fn('ROUND', [value]) : fn('ROUND', [value, decimals]);

/**
 * Helper: SIGN(x) - Returns the sign of a number (-1, 0, 1)
 */
export const sign = (value: OperandInput): FunctionNode => fn('SIGN', [value]);

/**
 * Helper: SIN(x) - Returns the sine of a number (in radians)
 */
export const sin = (value: OperandInput): FunctionNode => fn('SIN', [value]);

/**
 * Helper: SQRT(x) - Returns the square root of a number
 */
export const sqrt = (value: OperandInput): FunctionNode => fn('SQRT', [value]);

/**
 * Helper: TAN(x) - Returns the tangent of a number (in radians)
 */
export const tan = (value: OperandInput): FunctionNode => fn('TAN', [value]);

/**
 * Helper: TRUNC(x[, decimals]) / TRUNCATE(x, decimals) - Truncates a number without rounding
 */
export const trunc = (value: OperandInput, decimals?: OperandInput): FunctionNode =>
    decimals === undefined ? fn('TRUNC', [value]) : fn('TRUNC', [value, decimals]);

/**
 * Helper: TRUNCATE(x, decimals) - Alias for TRUNC
 */
export const truncate = (value: OperandInput, decimals: OperandInput): FunctionNode =>
    fn('TRUNCATE', [value, decimals]);
