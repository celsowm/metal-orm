import { ColumnNode, FunctionNode } from './expression-nodes.js';
import { columnOperand, valueToOperand, ValueOperandInput } from './expression-builders.js';
import { ColumnRef } from './types.js';
import { OrderByNode } from './query.js';
import { ORDER_DIRECTIONS, OrderDirection } from '../sql/sql.js';

const buildAggregate = (name: string) => (col: ColumnRef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name,
  args: [columnOperand(col)]
});

/**
 * Creates a COUNT function expression
 * @param col - Column to count
 * @returns Function node with COUNT
 */
export const count = buildAggregate('COUNT');

/**
 * Creates a SUM function expression
 * @param col - Column to sum
 * @returns Function node with SUM
 */
export const sum = buildAggregate('SUM');

/**
 * Creates an AVG function expression
 * @param col - Column to average
 * @returns Function node with AVG
 */
export const avg = buildAggregate('AVG');

/**
 * Creates a MIN function expression
 * @param col - Column to take the minimum of
 * @returns Function node with MIN
 */
export const min = buildAggregate('MIN');

/**
 * Creates a MAX function expression
 * @param col - Column to take the maximum of
 * @returns Function node with MAX
 */
export const max = buildAggregate('MAX');

type GroupConcatOrderByInput = {
  column: ColumnRef | ColumnNode;
  direction?: OrderDirection;
};

export type GroupConcatOptions = {
  separator?: ValueOperandInput;
  orderBy?: GroupConcatOrderByInput[];
};

const toOrderByNode = (order: GroupConcatOrderByInput): OrderByNode => ({
  type: 'OrderBy',
  term: columnOperand(order.column),
  direction: order.direction ?? ORDER_DIRECTIONS.ASC
});

/**
 * Aggregates grouped strings into a single value.
 */
export const groupConcat = (
  col: ColumnRef | ColumnNode,
  options?: GroupConcatOptions
): FunctionNode => ({
  type: 'Function',
  name: 'GROUP_CONCAT',
  args: [columnOperand(col)],
  orderBy: options?.orderBy?.map(toOrderByNode),
  separator: options?.separator !== undefined ? valueToOperand(options.separator) : undefined
});
