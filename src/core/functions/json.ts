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

export const jsonLength = (target: OperandInput, path?: OperandInput): FunctionNode =>
    path === undefined ? fn('JSON_LENGTH', [target]) : fn('JSON_LENGTH', [target, path]);

export const jsonSet = (target: OperandInput, path: OperandInput, value: OperandInput): FunctionNode =>
    fn('JSON_SET', [target, path, value]);

export const jsonArrayAgg = (value: OperandInput): FunctionNode => fn('JSON_ARRAYAGG', [value]);

export const jsonContains = (
    target: OperandInput,
    candidate: OperandInput,
    path?: OperandInput
): FunctionNode =>
    path === undefined ? fn('JSON_CONTAINS', [target, candidate]) : fn('JSON_CONTAINS', [target, candidate, path]);
