import { ColumnDef } from '../schema/column';
import type { SelectQueryNode, OrderByNode } from './query';

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

export type ExpressionNode =
  | BinaryExpressionNode
  | LogicalExpressionNode
  | NullExpressionNode
  | InExpressionNode
  | ExistsExpressionNode;

const isOperandNode = (node: any): node is OperandNode => {
  return node && ['Column', 'Literal', 'Function', 'JsonPath', 'ScalarSubquery', 'CaseExpression'].includes(node.type);
};

// Helper to convert Schema definition to AST Node
const toNode = (col: ColumnDef | OperandNode): OperandNode => {
  if (isOperandNode(col)) return col as OperandNode;
  const def = col as ColumnDef;
  return { type: 'Column', table: def.table || 'unknown', name: def.name };
};

const toRightNode = (val: OperandNode | ColumnDef | string | number | boolean | null): OperandNode => {
  if (val === null) return { type: 'Literal', value: null };
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return { type: 'Literal', value: val };
  }
  return toNode(val as OperandNode | ColumnDef);
};

// Factories
export const eq = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode => ({
  type: 'BinaryExpression',
  left: toNode(left),
  operator: '=',
  right: toRightNode(right)
});

export const gt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode => ({
  type: 'BinaryExpression',
  left: toNode(left),
  operator: '>',
  right: toRightNode(right)
});

export const lt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode => ({
  type: 'BinaryExpression',
  left: toNode(left),
  operator: '<',
  right: toRightNode(right)
});

export const like = (left: OperandNode | ColumnDef, pattern: string): BinaryExpressionNode => ({
  type: 'BinaryExpression',
  left: toNode(left),
  operator: 'LIKE',
  right: { type: 'Literal', value: pattern }
});

export const notLike = (left: OperandNode | ColumnDef, pattern: string): BinaryExpressionNode => ({
  type: 'BinaryExpression',
  left: toNode(left),
  operator: 'NOT LIKE',
  right: { type: 'Literal', value: pattern }
});

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

export const inList = (left: OperandNode | ColumnDef, values: (string | number | LiteralNode)[]): InExpressionNode => ({
  type: 'InExpression',
  left: toNode(left),
  operator: 'IN',
  right: values.map(v => toRightNode(v))
});

export const notInList = (left: OperandNode | ColumnDef, values: (string | number | LiteralNode)[]): InExpressionNode => ({
  type: 'InExpression',
  left: toNode(left),
  operator: 'NOT IN',
  right: values.map(v => toRightNode(v))
});

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
    then: toRightNode(c.then)
  })),
  else: elseValue !== undefined ? toRightNode(elseValue) : undefined
});

// Window function factories
export const rowNumber = (): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'ROW_NUMBER',
  args: []
});

export const rank = (): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'RANK',
  args: []
});

export const denseRank = (): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'DENSE_RANK',
  args: []
});

export const ntile = (n: number): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'NTILE',
  args: [{ type: 'Literal', value: n }]
});

export const lag = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [toNode(col) as ColumnNode, { type: 'Literal', value: offset }];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return {
    type: 'WindowFunction',
    name: 'LAG',
    args
  };
};

export const lead = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [toNode(col) as ColumnNode, { type: 'Literal', value: offset }];
  if (defaultValue !== undefined) {
    args.push({ type: 'Literal', value: defaultValue });
  }
  return {
    type: 'WindowFunction',
    name: 'LEAD',
    args
  };
};

export const firstValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'FIRST_VALUE',
  args: [toNode(col) as ColumnNode]
});

export const lastValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => ({
  type: 'WindowFunction',
  name: 'LAST_VALUE',
  args: [toNode(col) as ColumnNode]
});

export const windowFunction = (
  name: string,
  args: (ColumnDef | ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: (ColumnDef | ColumnNode)[],
  orderBy?: { column: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC' }[]
): WindowFunctionNode => {
  const node: WindowFunctionNode = {
    type: 'WindowFunction',
    name,
    args: args.map(arg => {
      if ((arg as ColumnDef).name && (arg as ColumnDef).table) {
        return toNode(arg as ColumnDef) as ColumnNode;
      } else if ((arg as LiteralNode).value !== undefined) {
        return arg as LiteralNode;
      } else if ((arg as JsonPathNode).path) {
        return arg as JsonPathNode;
      } else {
        return arg as ColumnNode;
      }
    })
  };

  if (partitionBy) {
    node.partitionBy = partitionBy.map(col => toNode(col) as ColumnNode);
  }

  if (orderBy) {
    node.orderBy = orderBy.map(o => ({
      type: 'OrderBy',
      column: toNode(o.column) as ColumnNode,
      direction: o.direction
    }));
  }

  return node;
};
