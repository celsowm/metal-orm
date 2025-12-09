import { SelectQueryNode } from './query.js';
import { SqlOperator } from '../sql/sql.js';
import { ColumnRef } from './types.js';
import {
  ColumnNode,
  FunctionNode,
  LiteralNode,
  JsonPathNode,
  OperandNode,
  CaseExpressionNode,
  WindowFunctionNode,
  BinaryExpressionNode,
  ExpressionNode,
  LogicalExpressionNode,
  NullExpressionNode,
  InExpressionNode,
  ExistsExpressionNode,
  BetweenExpressionNode,
  isOperandNode
} from './expression-nodes.js';

export type LiteralValue = LiteralNode['value'];
export type ValueOperandInput = OperandNode | LiteralValue;

/**
 * Converts a primitive or existing operand into an operand node
 * @param value - Value or operand to normalize
 * @returns OperandNode representing the value
 */
export const valueToOperand = (value: ValueOperandInput): OperandNode => {
  if (isOperandNode(value)) {
    return value;
  }

  return {
    type: 'Literal',
    value
  } as LiteralNode;
};

const toNode = (col: ColumnRef | OperandNode): OperandNode => {
  if (isOperandNode(col)) return col as OperandNode;
  const def = col as ColumnRef;
  return { type: 'Column', table: def.table || 'unknown', name: def.name };
};

const toLiteralNode = (value: string | number | boolean | null): LiteralNode => ({
  type: 'Literal',
  value
});

const isLiteralValue = (value: unknown): value is LiteralValue =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

export const isValueOperandInput = (value: unknown): value is ValueOperandInput =>
  isOperandNode(value) || isLiteralValue(value);

const toOperand = (val: OperandNode | ColumnRef | LiteralValue): OperandNode => {
  if (isLiteralValue(val)) {
    return valueToOperand(val);
  }

  return toNode(val);
};

export const columnOperand = (col: ColumnRef | ColumnNode): ColumnNode => toNode(col) as ColumnNode;

const createBinaryExpression = (
  operator: SqlOperator,
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number | boolean | null,
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

/**
 * Creates an equality expression (left = right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with equality operator
 */
export const eq = (left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number | boolean): BinaryExpressionNode =>
  createBinaryExpression('=', left, right);

/**
 * Creates a not equal expression (left != right)
 */
export const neq = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number | boolean
): BinaryExpressionNode => createBinaryExpression('!=', left, right);

/**
 * Creates a greater-than expression (left > right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with greater-than operator
 */
export const gt = (left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode =>
  createBinaryExpression('>', left, right);

/**
 * Creates a greater than or equal expression (left >= right)
 */
export const gte = (left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode =>
  createBinaryExpression('>=', left, right);

/**
 * Creates a less-than expression (left < right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with less-than operator
 */
export const lt = (left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode =>
  createBinaryExpression('<', left, right);

/**
 * Creates a less than or equal expression (left <= right)
 */
export const lte = (left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode =>
  createBinaryExpression('<=', left, right);

/**
 * Creates a LIKE pattern matching expression
 * @param left - Left operand
 * @param pattern - Pattern to match
 * @param escape - Optional escape character
 * @returns Binary expression node with LIKE operator
 */
export const like = (left: OperandNode | ColumnRef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('LIKE', left, pattern, escape);

/**
 * Creates a NOT LIKE pattern matching expression
 * @param left - Left operand
 * @param pattern - Pattern to match
 * @param escape - Optional escape character
 * @returns Binary expression node with NOT LIKE operator
 */
export const notLike = (left: OperandNode | ColumnRef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('NOT LIKE', left, pattern, escape);

/**
 * Creates a logical AND expression
 * @param operands - Expressions to combine with AND
 * @returns Logical expression node with AND operator
 */
export const and = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'AND',
  operands
});

/**
 * Creates a logical OR expression
 * @param operands - Expressions to combine with OR
 * @returns Logical expression node with OR operator
 */
export const or = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'OR',
  operands
});

/**
 * Creates an IS NULL expression
 * @param left - Operand to check for null
 * @returns Null expression node with IS NULL operator
 */
export const isNull = (left: OperandNode | ColumnRef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toNode(left),
  operator: 'IS NULL'
});

/**
 * Creates an IS NOT NULL expression
 * @param left - Operand to check for non-null
 * @returns Null expression node with IS NOT NULL operator
 */
export const isNotNull = (left: OperandNode | ColumnRef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toNode(left),
  operator: 'IS NOT NULL'
});

const createInExpression = (
  operator: 'IN' | 'NOT IN',
  left: OperandNode | ColumnRef,
  values: (string | number | LiteralNode)[]
): InExpressionNode => ({
  type: 'InExpression',
  left: toNode(left),
  operator,
  right: values.map(v => toOperand(v))
});

/**
 * Creates an IN expression (value IN list)
 * @param left - Operand to check
 * @param values - Values to check against
 * @returns IN expression node
 */
export const inList = (left: OperandNode | ColumnRef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('IN', left, values);

/**
 * Creates a NOT IN expression (value NOT IN list)
 * @param left - Operand to check
 * @param values - Values to check against
 * @returns NOT IN expression node
 */
export const notInList = (left: OperandNode | ColumnRef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('NOT IN', left, values);

const createBetweenExpression = (
  operator: 'BETWEEN' | 'NOT BETWEEN',
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => ({
  type: 'BetweenExpression',
  left: toNode(left),
  operator,
  lower: toOperand(lower),
  upper: toOperand(upper)
});

/**
 * Creates a BETWEEN expression (value BETWEEN lower AND upper)
 * @param left - Operand to check
 * @param lower - Lower bound
 * @param upper - Upper bound
 * @returns BETWEEN expression node
 */
export const between = (
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => createBetweenExpression('BETWEEN', left, lower, upper);

/**
 * Creates a NOT BETWEEN expression (value NOT BETWEEN lower AND upper)
 * @param left - Operand to check
 * @param lower - Lower bound
 * @param upper - Upper bound
 * @returns NOT BETWEEN expression node
 */
export const notBetween = (
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => createBetweenExpression('NOT BETWEEN', left, lower, upper);

/**
 * Creates a JSON path expression
 * @param col - Source column
 * @param path - JSON path expression
 * @returns JSON path node
 */
export const jsonPath = (col: ColumnRef | ColumnNode, path: string): JsonPathNode => ({
  type: 'JsonPath',
  column: columnOperand(col),
  path
});

/**
 * Creates a CASE expression
 * @param conditions - Array of WHEN-THEN conditions
 * @param elseValue - Optional ELSE value
 * @returns CASE expression node
 */
export const caseWhen = (
  conditions: { when: ExpressionNode; then: OperandNode | ColumnRef | string | number | boolean | null }[],
  elseValue?: OperandNode | ColumnRef | string | number | boolean | null
): CaseExpressionNode => ({
  type: 'CaseExpression',
  conditions: conditions.map(c => ({
    when: c.when,
    then: toOperand(c.then)
  })),
  else: elseValue !== undefined ? toOperand(elseValue) : undefined
});

/**
 * Creates an EXISTS expression
 * @param subquery - Subquery to check for existence
 * @returns EXISTS expression node
 */
export const exists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'EXISTS',
  subquery
});

/**
 * Creates a NOT EXISTS expression
 * @param subquery - Subquery to check for non-existence
 * @returns NOT EXISTS expression node
 */
export const notExists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'NOT EXISTS',
  subquery
});
