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

const afn = <T = unknown[]>(key: string, args: OperandInput[]): TypedExpression<T> => asType<T>(fn(key, args));

/**
 * Appends a value to the end of an array.
 * 
 * @param array - Array column or value.
 * @param value - Value to append.
 * @returns A `TypedExpression<unknown[]>` representing the `ARRAY_APPEND` SQL function.
 */
export const arrayAppend = (array: OperandInput, value: OperandInput): TypedExpression<unknown[]> =>
    afn<unknown[]>('ARRAY_APPEND', [array, value]);
