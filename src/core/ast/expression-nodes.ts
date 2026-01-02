import type { SelectQueryNode, OrderByNode } from './query.js';
import { SqlOperator, BitwiseOperator } from '../sql/sql.js';
import { ColumnRef } from './types.js';

/**
 * AST node representing a literal value
 */
export interface LiteralNode {
  type: 'Literal';
  /** The literal value (string, number, boolean, Date, or null) */
  value: string | number | boolean | Date | null;
}

/**
 * AST node representing a reference to a SELECT alias (for ORDER BY / GROUP BY).
 */
export interface AliasRefNode {
  type: 'AliasRef';
  /** Alias name to reference */
  name: string;
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

export type InExpressionRight = OperandNode[] | ScalarSubqueryNode;

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
 * AST node representing a CAST expression (CAST(value AS type)).
 */
export interface CastExpressionNode {
  type: 'Cast';
  /** Expression being cast */
  expression: OperandNode;
  /** SQL type literal, e.g. "varchar(255)" */
  castType: string;
  /** Optional alias for the result */
  alias?: string;
}

/**
 * AST node representing a COLLATE expression (expression COLLATE collationName).
 */
export interface CollateExpressionNode {
  type: 'Collate';
  /** Expression to be collated */
  expression: OperandNode;
  /** Collation name */
  collation: string;
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
 * AST node representing an arithmetic expression (e.g., a + b)
 */
export interface ArithmeticExpressionNode {
  type: 'ArithmeticExpression';
  left: OperandNode;
  operator: '+' | '-' | '*' | '/';
  right: OperandNode;
}

/**
 * Union type representing any operand that can be used in expressions
 */
export type OperandNode =
  | AliasRefNode
  | ColumnNode
  | LiteralNode
  | FunctionNode
  | JsonPathNode
  | ScalarSubqueryNode
  | CaseExpressionNode
  | CastExpressionNode
  | WindowFunctionNode
  | ArithmeticExpressionNode
  | BitwiseExpressionNode
  | CollateExpressionNode;

const operandTypes = new Set<OperandNode['type']>([
  'AliasRef',
  'Column',
  'Literal',
  'Function',
  'JsonPath',
  'ScalarSubquery',
  'CaseExpression',
  'Cast',
  'WindowFunction',
  'ArithmeticExpression',
  'BitwiseExpression',
  'Collate'
]);

const hasTypeProperty = (value: unknown): value is { type?: string } =>
  typeof value === 'object' && value !== null && 'type' in value;

export const isOperandNode = (node: unknown): node is OperandNode => {
  if (!hasTypeProperty(node)) return false;
  return operandTypes.has(node.type as OperandNode['type']);
};

export const isFunctionNode = (node: unknown): node is FunctionNode =>
  isOperandNode(node) && node.type === 'Function';
export const isCaseExpressionNode = (node: unknown): node is CaseExpressionNode =>
  isOperandNode(node) && node.type === 'CaseExpression';

export const isCastExpressionNode = (node: unknown): node is CastExpressionNode =>
  isOperandNode(node) && node.type === 'Cast';
export const isCollateExpressionNode = (node: unknown): node is CollateExpressionNode =>
  isOperandNode(node) && node.type === 'Collate';
export const isWindowFunctionNode = (node: unknown): node is WindowFunctionNode =>
  isOperandNode(node) && node.type === 'WindowFunction';
export const isExpressionSelectionNode = (
  node: ColumnRef | FunctionNode | CaseExpressionNode | CastExpressionNode | WindowFunctionNode
): node is FunctionNode | CaseExpressionNode | CastExpressionNode | WindowFunctionNode =>
  isFunctionNode(node) || isCaseExpressionNode(node) || isCastExpressionNode(node) || isWindowFunctionNode(node);

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
 * AST node representing a bitwise expression (e.g., a & b)
 */
export interface BitwiseExpressionNode {
  type: 'BitwiseExpression';
  /** Left operand */
  left: OperandNode;
  /** Bitwise operator */
  operator: BitwiseOperator;
  /** Right operand */
  right: OperandNode;
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
  right: InExpressionRight;
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
  | BetweenExpressionNode
  | ArithmeticExpressionNode
  | BitwiseExpressionNode;
