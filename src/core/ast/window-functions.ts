import { ColumnDef } from '../../schema/column.js';
import { ColumnNode, LiteralNode, JsonPathNode, WindowFunctionNode } from './expression-nodes.js';
import { columnOperand } from './expression-builders.js';
import { OrderDirection } from '../sql/sql.js';
import { OrderByNode } from './query.js';

const buildWindowFunction = (
  name: string,
  args: (ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: ColumnNode[],
  orderBy?: OrderByNode[]
): WindowFunctionNode => {
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

  return node;
};

/**
 * Creates a ROW_NUMBER window function
 * @returns Window function node for ROW_NUMBER
 */
export const rowNumber = (): WindowFunctionNode => buildWindowFunction('ROW_NUMBER');

/**
 * Creates a RANK window function
 * @returns Window function node for RANK
 */
export const rank = (): WindowFunctionNode => buildWindowFunction('RANK');

/**
 * Creates a DENSE_RANK window function
 * @returns Window function node for DENSE_RANK
 */
export const denseRank = (): WindowFunctionNode => buildWindowFunction('DENSE_RANK');

/**
 * Creates an NTILE window function
 * @param n - Number of buckets
 * @returns Window function node for NTILE
 */
export const ntile = (n: number): WindowFunctionNode =>
  buildWindowFunction('NTILE', [{ type: 'Literal', value: n }]);

/**
 * Creates a LAG window function
 * @param col - Column to lag
 * @param offset - Offset (defaults to 1)
 * @param defaultValue - Default value if no row exists
 * @returns Window function node for LAG
 */
export const lag = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [
    columnOperand(col),
    { type: 'Literal', value: offset }
  ];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction('LAG', args);
};

/**
 * Creates a LEAD window function
 * @param col - Column to lead
 * @param offset - Offset (defaults to 1)
 * @param defaultValue - Default value if no row exists
 * @returns Window function node for LEAD
 */
export const lead = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [
    columnOperand(col),
    { type: 'Literal', value: offset }
  ];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction('LEAD', args);
};

/**
 * Creates a FIRST_VALUE window function
 * @param col - Column to get first value from
 * @returns Window function node for FIRST_VALUE
 */
export const firstValue = (col: ColumnDef | ColumnNode): WindowFunctionNode =>
  buildWindowFunction('FIRST_VALUE', [columnOperand(col)]);

/**
 * Creates a LAST_VALUE window function
 * @param col - Column to get last value from
 * @returns Window function node for LAST_VALUE
 */
export const lastValue = (col: ColumnDef | ColumnNode): WindowFunctionNode =>
  buildWindowFunction('LAST_VALUE', [columnOperand(col)]);

/**
 * Creates a custom window function
 * @param name - Window function name
 * @param args - Function arguments
 * @param partitionBy - Optional PARTITION BY columns
 * @param orderBy - Optional ORDER BY clauses
 * @returns Window function node
 */
export const windowFunction = (
  name: string,
  args: (ColumnDef | ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: (ColumnDef | ColumnNode)[],
  orderBy?: { column: ColumnDef | ColumnNode; direction: OrderDirection }[]
): WindowFunctionNode => {
  const nodeArgs = args.map(arg => {
    if (typeof (arg as LiteralNode).value !== 'undefined') {
      return arg as LiteralNode;
    }
    if ('path' in arg) {
      return arg as JsonPathNode;
    }
    return columnOperand(arg as ColumnDef | ColumnNode);
  });

  const partitionNodes = partitionBy?.map(col => columnOperand(col)) ?? undefined;
  const orderNodes: OrderByNode[] | undefined = orderBy?.map(o => ({
    type: 'OrderBy',
    column: columnOperand(o.column),
    direction: o.direction
  }));

  return buildWindowFunction(name, nodeArgs, partitionNodes, orderNodes);
};
