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
const afn = <T = any>(key: string, args: OperandInput[]): TypedExpression<T> => asType<T>(fn(key, args));

/**
 * Returns the number of elements in a JSON array or object.
 * 
 * @param target - JSON column or value.
 * @param path - Optional JSON path.
 * @returns A `TypedExpression<number>` representing the `JSON_LENGTH` SQL function.
 */
export const jsonLength = (target: OperandInput, path?: OperandInput): TypedExpression<number> =>
    path === undefined ? nfn('JSON_LENGTH', [target]) : nfn('JSON_LENGTH', [target, path]);

/**
 * Inserts or updates a value in a JSON document.
 * 
 * @param target - JSON column or value.
 * @param path - JSON path to set.
 * @param value - Value to set.
 * @returns A `TypedExpression<any>` representing the `JSON_SET` SQL function.
 */
export const jsonSet = (target: OperandInput, path: OperandInput, value: OperandInput): TypedExpression<any> =>
    afn('JSON_SET', [target, path, value]);

/**
 * Aggregates values into a JSON array.
 * 
 * @param value - Column or expression to aggregate.
 * @returns A `TypedExpression<any[]>` representing the `JSON_ARRAYAGG` SQL function.
 */
export const jsonArrayAgg = (value: OperandInput): TypedExpression<any[]> => afn<any[]>('JSON_ARRAYAGG', [value]);

/**
 * Checks if a JSON document contains a specific piece of data.
 * 
 * @param target - JSON column or value.
 * @param candidate - Data to look for.
 * @param path - Optional JSON path to search within.
 * @returns A `TypedExpression<boolean>` representing the `JSON_CONTAINS` SQL function.
 */
export const jsonContains = (
    target: OperandInput,
    candidate: OperandInput,
    path?: OperandInput
): TypedExpression<boolean> =>
    path === undefined ? afn<boolean>('JSON_CONTAINS', [target, candidate]) : afn<boolean>('JSON_CONTAINS', [target, candidate, path]);
