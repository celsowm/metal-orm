import { ColumnDef } from '../schema/column';
import type { SelectQueryNode, OrderByNode } from './query';
import { OrderDirection } from '../constants/sql';

export interface LiteralNode {
  type: 'Literal';
  value: string | number | boolean | null;
}

export interface ColumnNode {
  type: 'Column';
  table: string;
  name: string;
  alias?: string;
}

export interface FunctionNode {
  type: 'Function';
  name: string;
  args: (ColumnNode | LiteralNode | JsonPathNode)[]; // Allow JSON args
  alias?: string;
}

export interface JsonPathNode {
  type: 'JsonPath';
  column: ColumnNode;
  path: string;
  alias?: string;
}

export interface ScalarSubqueryNode {
  type: 'ScalarSubquery';
  query: SelectQueryNode;
  alias?: string;
}

export interface CaseExpressionNode {
  type: 'CaseExpression';
  conditions: { when: ExpressionNode; then: OperandNode }[];
  else?: OperandNode;
  alias?: string;
}

export interface WindowFunctionNode {
  type: 'WindowFunction';
  name: string;
  args: (ColumnNode | LiteralNode | JsonPathNode)[];
  partitionBy?: ColumnNode[];
  orderBy?: OrderByNode[];
  alias?: string;
}

export type OperandNode = ColumnNode | LiteralNode | FunctionNode | JsonPathNode | ScalarSubqueryNode | CaseExpressionNode | WindowFunctionNode;

export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  left: OperandNode;
  operator: string;
  right: OperandNode;
  escape?: LiteralNode;
}

export interface LogicalExpressionNode {
  type: 'LogicalExpression';
  operator: 'AND' | 'OR';
  operands: ExpressionNode[];
}

export interface NullExpressionNode {
  type: 'NullExpression';
  left: OperandNode;
  operator: 'IS NULL' | 'IS NOT NULL';
}

export interface InExpressionNode {
  type: 'InExpression';
  left: OperandNode;
  operator: 'IN' | 'NOT IN';
  right: OperandNode[];
}

export interface ExistsExpressionNode {
  type: 'ExistsExpression';
  operator: 'EXISTS' | 'NOT EXISTS';
  subquery: SelectQueryNode;
}

export interface BetweenExpressionNode {
  type: 'BetweenExpression';
  left: OperandNode;
  operator: 'BETWEEN' | 'NOT BETWEEN';
  lower: OperandNode;
  upper: OperandNode;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | LogicalExpressionNode
  | NullExpressionNode
  | InExpressionNode
  | ExistsExpressionNode
  | BetweenExpressionNode;

const operandTypes = new Set<OperandNode['type']>([
  'Column',
  'Literal',
  'Function',
  'JsonPath',
  'ScalarSubquery',
  'CaseExpression',
  'WindowFunction'
]);

const isOperandNode = (node: any): node is OperandNode => {
  return node && operandTypes.has(node.type);
};

// Helper to convert Schema definition to AST Node
const toNode = (col: ColumnDef | OperandNode): OperandNode => {
  if (isOperandNode(col)) return col as OperandNode;
  const def = col as ColumnDef;
  return { type: 'Column', table: def.table || 'unknown', name: def.name };
};

const toLiteralNode = (value: string | number | boolean | null): LiteralNode => ({
  type: 'Literal',
  value
});

const toOperand = (val: OperandNode | ColumnDef | string | number | boolean | null): OperandNode => {
  if (val === null) return { type: 'Literal', value: null };
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return { type: 'Literal', value: val };
  }
  return toNode(val as OperandNode | ColumnDef);
};

// Factories
const createBinaryExpression = (
  operator: string,
  left: OperandNode | ColumnDef,
  right: OperandNode | ColumnDef | string | number | boolean | null,
  escape?: string
): BinaryExpressionNode => {
  const node: BinaryExpressionNode = {
    type: 'BinaryExpression',
    left: toNode(left),
    operator,
    right: toOperand(right)
  };

  if (escape !== undefined) {
    node.escape = toLiteralNode(escape);
  }

  return node;
};

export const eq = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('=', left, right);

export const gt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('>', left, right);

export const lt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('<', left, right);

export const like = (left: OperandNode | ColumnDef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('LIKE', left, pattern, escape);

export const notLike = (left: OperandNode | ColumnDef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('NOT LIKE', left, pattern, escape);

export const and = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'AND',
  operands
});

export const or = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'OR',
  operands
});

export const isNull = (left: OperandNode | ColumnDef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toNode(left),
  operator: 'IS NULL'
});

export const isNotNull = (left: OperandNode | ColumnDef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toNode(left),
  operator: 'IS NOT NULL'
});

const createInExpression = (
  operator: 'IN' | 'NOT IN',
  left: OperandNode | ColumnDef,
  values: (string | number | LiteralNode)[]
): InExpressionNode => ({
  type: 'InExpression',
  left: toNode(left),
  operator,
  right: values.map(v => toOperand(v))
});

export const inList = (left: OperandNode | ColumnDef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('IN', left, values);

export const notInList = (left: OperandNode | ColumnDef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('NOT IN', left, values);

const createBetweenExpression = (
  operator: 'BETWEEN' | 'NOT BETWEEN',
  left: OperandNode | ColumnDef,
  lower: OperandNode | ColumnDef | string | number,
  upper: OperandNode | ColumnDef | string | number
): BetweenExpressionNode => ({
  type: 'BetweenExpression',
  left: toNode(left),
  operator,
  lower: toOperand(lower),
  upper: toOperand(upper)
});

export const between = (
  left: OperandNode | ColumnDef,
  lower: OperandNode | ColumnDef | string | number,
  upper: OperandNode | ColumnDef | string | number
): BetweenExpressionNode => createBetweenExpression('BETWEEN', left, lower, upper);

export const notBetween = (
  left: OperandNode | ColumnDef,
  lower: OperandNode | ColumnDef | string | number,
  upper: OperandNode | ColumnDef | string | number
): BetweenExpressionNode => createBetweenExpression('NOT BETWEEN', left, lower, upper);

export const jsonPath = (col: ColumnDef | ColumnNode, path: string): JsonPathNode => ({
  type: 'JsonPath',
  column: toNode(col) as ColumnNode,
  path
});

export const count = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'COUNT',
  args: [toNode(col) as ColumnNode]
});

export const sum = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'SUM',
  args: [toNode(col) as ColumnNode]
});

export const avg = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'AVG',
  args: [toNode(col) as ColumnNode]
});

export const exists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'EXISTS',
  subquery
});

export const notExists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'NOT EXISTS',
  subquery
});

export const caseWhen = (
  conditions: { when: ExpressionNode; then: OperandNode | ColumnDef | string | number | boolean | null }[],
  elseValue?: OperandNode | ColumnDef | string | number | boolean | null
): CaseExpressionNode => ({
  type: 'CaseExpression',
  conditions: conditions.map(c => ({
    when: c.when,
    then: toOperand(c.then)
  })),
  else: elseValue !== undefined ? toOperand(elseValue) : undefined
});

// Window function factories
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

export const rowNumber = (): WindowFunctionNode => buildWindowFunction('ROW_NUMBER');
export const rank = (): WindowFunctionNode => buildWindowFunction('RANK');
export const denseRank = (): WindowFunctionNode => buildWindowFunction('DENSE_RANK');
export const ntile = (n: number): WindowFunctionNode => buildWindowFunction('NTILE', [{ type: 'Literal', value: n }]);

const columnOperand = (col: ColumnDef | ColumnNode): ColumnNode => toNode(col) as ColumnNode;

export const lag = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [columnOperand(col), { type: 'Literal', value: offset }];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction('LAG', args);
};

export const lead = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [columnOperand(col), { type: 'Literal', value: offset }];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return buildWindowFunction('LEAD', args);
};

export const firstValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => buildWindowFunction('FIRST_VALUE', [columnOperand(col)]);
export const lastValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => buildWindowFunction('LAST_VALUE', [columnOperand(col)]);

export const windowFunction = (
  name: string,
  args: (ColumnDef | ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: (ColumnDef | ColumnNode)[],
  orderBy?: { column: ColumnDef | ColumnNode, direction: OrderDirection }[]
): WindowFunctionNode => {
  const nodeArgs = args.map(arg => {
    if ((arg as LiteralNode).value !== undefined) {
      return arg as LiteralNode;
    }
    if ((arg as JsonPathNode).path) {
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
