import { ColumnNode } from './expression-nodes.js';
import { columnOperand, valueToOperand, ValueOperandInput } from './expression-builders.js';
import { ColumnRef } from './types.js';
import { OrderByNode } from './query.js';
import { TypedExpression, asType } from './expression.js';
import { ORDER_DIRECTIONS, OrderDirection } from '../sql/sql.js';

const buildAggregate = (name: string) => (col: ColumnRef | ColumnNode): TypedExpression<number> => asType<number>({
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

/**
 * Creates a COUNT(*) function expression.
 * 
 * @returns A `TypedExpression<number>` representing the `COUNT(*)` SQL function.
 */
export const countAll = (): TypedExpression<number> => asType<number>({
  type: 'Function',
  name: 'COUNT',
  args: []
});

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
 * 
 * @param col - Column or expression to aggregate.
 * @param options - Optional separator and ordering.
 * @returns A `TypedExpression<string>` representing the `GROUP_CONCAT` SQL function.
 * 
 * @example
 * groupConcat(users.name, { separator: ', ', orderBy: [{ column: users.name }] });
 */
export const groupConcat = (
  col: ColumnRef | ColumnNode,
  options?: GroupConcatOptions
): TypedExpression<string> => asType<string>({
  type: 'Function',
  name: 'GROUP_CONCAT',
  args: [columnOperand(col)],
  orderBy: options?.orderBy?.map(toOrderByNode),
  separator: options?.separator !== undefined ? valueToOperand(options.separator) : undefined
});

/**
 * Creates a STDDEV function expression
 * @param col - Column to calculate standard deviation for
 * @returns Function node with STDDEV
 */
export const stddev = buildAggregate('STDDEV');

/**
 * Creates a VARIANCE function expression
 * @param col - Column to calculate variance for
 * @returns Function node with VARIANCE
 */
export const variance = buildAggregate('VARIANCE');
