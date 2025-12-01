import { ColumnDef } from '../schema/column';

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

export type OperandNode = ColumnNode | LiteralNode | FunctionNode | JsonPathNode;

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

export type ExpressionNode = 
  | BinaryExpressionNode 
  | LogicalExpressionNode 
  | NullExpressionNode 
  | InExpressionNode;

// Helper to convert Schema definition to AST Node
const toNode = (col: ColumnDef | OperandNode): OperandNode => {
    if ((col as any).type) return col as OperandNode;
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