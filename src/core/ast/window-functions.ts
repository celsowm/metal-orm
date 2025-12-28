import { ColumnNode, LiteralNode, JsonPathNode, WindowFunctionNode } from './expression-nodes.js';
import { columnOperand } from './expression-builders.js';
import { OrderDirection } from '../sql/sql.js';
import { OrderByNode } from './query.js';
import { ColumnRef } from './types.js';
import { TypedExpression, asType } from './expression.js';

const buildWindowFunction = <T = unknown>(
  name: string,
  args: (ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: ColumnNode[],
  orderBy?: OrderByNode[]
): TypedExpression<T> => {
  const node: WindowFunctionNode = {
    type: 'WindowFunction',
    name,
    args
  };

  if (partitionBy && partitionBy.length) {
    node.partitionBy = partitionBy;
  }

  if (orderBy && orderBy.length) {
    node.orderBy = orderBy;
  }

  return asType<T>(node);
};

/**
 * Creates a ROW_NUMBER window function.
 * 
 * @returns A `TypedExpression<number>` representing the `ROW_NUMBER` window function.
 */
export const rowNumber = (): TypedExpression<number> => buildWindowFunction<number>('ROW_NUMBER');

/**
 * Creates a RANK window function.
 * 
 * @returns A `TypedExpression<number>` representing the `RANK` window function.
 */
export const rank = (): TypedExpression<number> => buildWindowFunction<number>('RANK');

/**
 * Creates a DENSE_RANK window function.
 * 
 * @returns A `TypedExpression<number>` representing the `DENSE_RANK` window function.
 */
export const denseRank = (): TypedExpression<number> => buildWindowFunction<number>('DENSE_RANK');

/**
 * Creates an NTILE window function.
 * 
 * @param n - Number of buckets.
 * @returns A `TypedExpression<number>` representing the `NTILE` window function.
 */
export const ntile = (n: number): TypedExpression<number> =>
  buildWindowFunction<number>('NTILE', [{ type: 'Literal', value: n }]);

/**
 * Creates a LAG window function.
 * 
 * @param col - Column or expression to lag.
 * @param offset - Optional offset (defaults to 1).
 * @param defaultValue - Optional default value.
 * @returns A `TypedExpression<T>` representing the `LAG` window function.
 */
export const lag = <T = unknown>(
  col: ColumnRef | ColumnNode,
  offset: number = 1,
  defaultValue?: LiteralNode['value']
): TypedExpression<T> => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [
    columnOperand(col),
    { type: 'Literal', value: offset }
  ];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction<T>('LAG', args);
};

/**
 * Creates a LEAD window function.
 * 
 * @param col - Column or expression to lead.
 * @param offset - Optional offset (defaults to 1).
 * @param defaultValue - Optional default value.
 * @returns A `TypedExpression<T>` representing the `LEAD` window function.
 */
export const lead = <T = unknown>(
  col: ColumnRef | ColumnNode,
  offset: number = 1,
  defaultValue?: LiteralNode['value']
): TypedExpression<T> => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [
    columnOperand(col),
    { type: 'Literal', value: offset }
  ];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction<T>('LEAD', args);
};

/**
 * Creates a FIRST_VALUE window function.
 * 
 * @param col - Column or expression to get first value from.
 * @returns A `TypedExpression<T>` representing the `FIRST_VALUE` window function.
 */
export const firstValue = <T = unknown>(col: ColumnRef | ColumnNode): TypedExpression<T> =>
  buildWindowFunction<T>('FIRST_VALUE', [columnOperand(col)]);

/**
 * Creates a LAST_VALUE window function.
 * 
 * @param col - Column or expression to get last value from.
 * @returns A `TypedExpression<T>` representing the `LAST_VALUE` window function.
 */
export const lastValue = <T = unknown>(col: ColumnRef | ColumnNode): TypedExpression<T> =>
  buildWindowFunction<T>('LAST_VALUE', [columnOperand(col)]);

/**
 * Creates a custom window function.
 * 
 * @param name - Window function name.
 * @param args - Function arguments.
 * @param partitionBy - Optional PARTITION BY columns.
 * @param orderBy - Optional ORDER BY clauses.
 * @returns A `TypedExpression<T>` representing the window function.
 */
export const windowFunction = <T = unknown>(
  name: string,
  args: (ColumnRef | ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: (ColumnRef | ColumnNode)[],
  orderBy?: { column: ColumnRef | ColumnNode; direction: OrderDirection }[]
): TypedExpression<T> => {
  const nodeArgs = args.map(arg => {
    if (typeof (arg as LiteralNode).value !== 'undefined') {
      return arg as LiteralNode;
    }
    if ('path' in arg) {
      return arg as JsonPathNode;
    }
    return columnOperand(arg as ColumnRef | ColumnNode);
  });

  const partitionNodes = partitionBy?.map(col => columnOperand(col)) ?? undefined;
  const orderNodes: OrderByNode[] | undefined = orderBy?.map(o => ({
    type: 'OrderBy',
    term: columnOperand(o.column),
    direction: o.direction
  }));

  return buildWindowFunction<T>(name, nodeArgs, partitionNodes, orderNodes);
};
