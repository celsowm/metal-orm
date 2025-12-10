import type { SelectQueryNode, OrderByNode } from './query.js';
import { SqlOperator } from '../sql/sql.js';
import { ColumnRef } from './types.js';

/**
 * AST node representing a literal value
 */
export interface LiteralNode {
  type: 'Literal';
  /** The literal value (string, number, boolean, or null) */
  value: string | number | boolean | null;
}

/**
 * AST node representing a column reference
 */
export interface ColumnNode {
  type: 'Column';
  /** Table name the column belongs to */
  table: string;
  /** Column name */
  name: string;
  /** Optional alias for the column */
  alias?: string;
  /** Optional scope marker (e.g., 'outer' for correlated references) */
  scope?: 'outer' | 'default';
}

/**
 * AST node representing a function call
 */
export interface FunctionNode {
  type: 'Function';
  /** Function name (e.g., COUNT, SUM) */
  name: string;
  /** Optional canonical function key for dialect-aware rendering */
  fn?: string;
  /** Function arguments */
  args: OperandNode[];
  /** Optional alias for the function result */
  alias?: string;
  /** Optional ORDER BY clause used by aggregations like GROUP_CONCAT */
  orderBy?: OrderByNode[];
  /** Optional separator argument used by GROUP_CONCAT-like functions */
  separator?: OperandNode;
  /** Optional DISTINCT modifier */
  distinct?: boolean;
}

/**
 * AST node representing a JSON path expression
 */
export interface JsonPathNode {
  type: 'JsonPath';
  /** Source column */
  column: ColumnNode;
  /** JSON path expression */
  path: string;
  /** Optional alias for the result */
  alias?: string;
}

/**
 * AST node representing a scalar subquery
 */
export interface ScalarSubqueryNode {
  type: 'ScalarSubquery';
  /** Subquery to execute */
  query: SelectQueryNode;
  /** Optional alias for the subquery result */
  alias?: string;
}

/**
 * AST node representing a CASE expression
 */
export interface CaseExpressionNode {
  type: 'CaseExpression';
  /** WHEN-THEN conditions */
  conditions: { when: ExpressionNode; then: OperandNode }[];
  /** Optional ELSE clause */
  else?: OperandNode;
  /** Optional alias for the result */
  alias?: string;
}

/**
 * AST node representing a window function
 */
export interface WindowFunctionNode {
  type: 'WindowFunction';
  /** Window function name (e.g., ROW_NUMBER, RANK) */
  name: string;
  /** Function arguments */
  args: (ColumnNode | LiteralNode | JsonPathNode)[];
  /** Optional PARTITION BY clause */
  partitionBy?: ColumnNode[];
  /** Optional ORDER BY clause */
  orderBy?: OrderByNode[];
  /** Optional alias for the result */
  alias?: string;
}

/**
 * Union type representing any operand that can be used in expressions
 */
export type OperandNode =
  | ColumnNode
  | LiteralNode
  | FunctionNode
  | JsonPathNode
  | ScalarSubqueryNode
  | CaseExpressionNode
  | WindowFunctionNode;

const operandTypes = new Set<OperandNode['type']>([
  'Column',
  'Literal',
  'Function',
  'JsonPath',
  'ScalarSubquery',
  'CaseExpression',
  'WindowFunction'
]);

export const isOperandNode = (node: any): node is OperandNode => node && operandTypes.has(node.type);

export const isFunctionNode = (node: any): node is FunctionNode => node?.type === 'Function';
export const isCaseExpressionNode = (node: any): node is CaseExpressionNode => node?.type === 'CaseExpression';
export const isWindowFunctionNode = (node: any): node is WindowFunctionNode => node?.type === 'WindowFunction';
export const isExpressionSelectionNode = (
  node: ColumnRef | FunctionNode | CaseExpressionNode | WindowFunctionNode
): node is FunctionNode | CaseExpressionNode | WindowFunctionNode =>
  isFunctionNode(node) || isCaseExpressionNode(node) || isWindowFunctionNode(node);

/**
 * AST node representing a binary expression (e.g., column = value)
 */
export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  /** Left operand */
  left: OperandNode;
  /** Comparison operator */
  operator: SqlOperator;
  /** Right operand */
  right: OperandNode;
  /** Optional escape character for LIKE expressions */
  escape?: LiteralNode;
}

/**
 * AST node representing a logical expression (AND/OR)
 */
export interface LogicalExpressionNode {
  type: 'LogicalExpression';
  /** Logical operator (AND or OR) */
  operator: 'AND' | 'OR';
  /** Operands to combine */
  operands: ExpressionNode[];
}

/**
 * AST node representing a null check expression
 */
export interface NullExpressionNode {
  type: 'NullExpression';
  /** Operand to check for null */
  left: OperandNode;
  /** Null check operator */
  operator: 'IS NULL' | 'IS NOT NULL';
}

/**
 * AST node representing an IN/NOT IN expression
 */
export interface InExpressionNode {
  type: 'InExpression';
  /** Left operand to check */
  left: OperandNode;
  /** IN/NOT IN operator */
  operator: 'IN' | 'NOT IN';
  /** Values to check against */
  right: OperandNode[];
}

/**
 * AST node representing an EXISTS/NOT EXISTS expression
 */
export interface ExistsExpressionNode {
  type: 'ExistsExpression';
  /** EXISTS/NOT EXISTS operator */
  operator: SqlOperator;
  /** Subquery to check */
  subquery: SelectQueryNode;
}

/**
 * AST node representing a BETWEEN/NOT BETWEEN expression
 */
export interface BetweenExpressionNode {
  type: 'BetweenExpression';
  /** Operand to check */
  left: OperandNode;
  /** BETWEEN/NOT BETWEEN operator */
  operator: 'BETWEEN' | 'NOT BETWEEN';
  /** Lower bound */
  lower: OperandNode;
  /** Upper bound */
  upper: OperandNode;
}

/**
 * Union type representing any supported expression node
 */
export type ExpressionNode =
  | BinaryExpressionNode
  | LogicalExpressionNode
  | NullExpressionNode
  | InExpressionNode
  | ExistsExpressionNode
  | BetweenExpressionNode;
