import { SelectQueryNode } from './query.js';
import { SqlOperator, BitwiseOperator } from '../sql/sql.js';
import { ColumnRef } from './types.js';
import {
  ColumnNode,
  LiteralNode,
  JsonPathNode,
  OperandNode,
  CaseExpressionNode,
  CastExpressionNode,
  BinaryExpressionNode,
  ExpressionNode,
  LogicalExpressionNode,
  NullExpressionNode,
  InExpressionNode,
  ExistsExpressionNode,
  InExpressionRight,
  ScalarSubqueryNode,
  BetweenExpressionNode,
  isOperandNode,
  AliasRefNode,
  ArithmeticExpressionNode,
  BitwiseExpressionNode,
  CollateExpressionNode
} from './expression-nodes.js';

export type LiteralValue = LiteralNode['value'];
export type ValueOperandInput = OperandNode | LiteralValue;

export type TypedLike<T> = { tsType?: T } | { __tsType: T };

/**
 * Type guard to check if a value is a literal value
 */
const isLiteralValue = (value: unknown): value is LiteralValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  value instanceof Date ||
  Buffer.isBuffer(value);


/**
 * Converts a primitive value to a LiteralNode
 */
const toLiteralNode = (value: LiteralValue): LiteralNode => ({
  type: 'Literal',
  value: value instanceof Date ? value.toISOString() : value
});

/**
 * Converts a ColumnRef to a ColumnNode
 * @throws Error if the ColumnRef doesn't have a table specified
 */
const columnRefToNode = (col: ColumnRef): ColumnNode => {
  if (!col.table) {
    throw new Error(
      `Column "${col.name}" requires a table reference. ` +
      `Use columnOperand with a fully qualified ColumnRef or ColumnNode.`
    );
  }
  return { type: 'Column', table: col.table, name: col.name };
};

/**
 * Unified conversion function: converts any valid input to an OperandNode
 * @param value - Value to convert (OperandNode, ColumnRef, or literal value)
 * @returns OperandNode representing the value
 */
const toOperandNode = (value: OperandNode | ColumnRef | LiteralValue): OperandNode => {
  // Already an operand node
  if (isOperandNode(value)) {
    return value;
  }

  // Literal value
  if (isLiteralValue(value)) {
    return toLiteralNode(value);
  }

  // Must be ColumnRef
  return columnRefToNode(value as ColumnRef);
};

/**
 * Converts a primitive or existing operand into an operand node
 * @param value - Value or operand to normalize
 * @returns OperandNode representing the value
 */
export const valueToOperand = (value: ValueOperandInput): OperandNode => {
  if (isOperandNode(value)) {
    return value;
  }
  return toLiteralNode(value);
};

/**
 * Converts various input types to an OperandNode
 */
const toOperand = (val: OperandNode | ColumnRef | LiteralValue): OperandNode => toOperandNode(val);

export const isValueOperandInput = (value: unknown): value is ValueOperandInput =>
  isOperandNode(value) || isLiteralValue(value);

export type SelectQueryInput = SelectQueryNode | { getAST(): SelectQueryNode };

const hasQueryAst = (value: SelectQueryInput): value is { getAST(): SelectQueryNode } =>
  typeof (value as { getAST?: unknown }).getAST === 'function';

const resolveSelectQueryNode = (query: SelectQueryInput): SelectQueryNode =>
  hasQueryAst(query) ? query.getAST() : query;

const toScalarSubqueryNode = (query: SelectQueryInput): ScalarSubqueryNode => ({
  type: 'ScalarSubquery',
  query: resolveSelectQueryNode(query)
});

/**
 * Converts a ColumnRef or ColumnNode to a ColumnNode
 * @param col - Column reference or node
 * @returns ColumnNode
 * @throws Error if ColumnRef doesn't have a table specified
 */
export const columnOperand = (col: ColumnRef | ColumnNode): ColumnNode => {
  if (isOperandNode(col) && col.type === 'Column') {
    return col;
  }
  return columnRefToNode(col as ColumnRef);
};

/**
 * Marks a column reference as an outer-scope reference for correlated subqueries.
 * Primarily semantic; SQL rendering still uses the provided table/alias name.
 */
export const outerRef = (col: ColumnRef | ColumnNode): ColumnNode => ({
  ...columnOperand(col),
  scope: 'outer'
});

/**
 * References a SELECT alias (useful for ORDER BY / GROUP BY).
 */
export const aliasRef = (name: string): AliasRefNode => ({
  type: 'AliasRef',
  name
});

/**
 * Creates an outer-scoped column reference using a specific table or alias name.
 */
export const correlateBy = (table: string, column: string): ColumnNode => outerRef({ name: column, table });

const createBinaryExpression = (
  operator: SqlOperator,
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number | boolean | null,
  escape?: string
): BinaryExpressionNode => {
  const node: BinaryExpressionNode = {
    type: 'BinaryExpression',
    left: toOperandNode(left),
    operator,
    right: toOperand(right)
  };

  if (escape !== undefined) {
    node.escape = toLiteralNode(escape);
  }

  return node;
};

/**
 * Creates an equality expression (`left = right`).
 * 
 * Supports type safety when used with `ColumnDef` objects containing strict type information.
 * 
 * @param left - The left operand (column or value).
 * @param right - The right operand (column or value).
 * @returns A `BinaryExpressionNode` representing the equality check.
 * 
 * @example
 * // Basic usage
 * eq(users.id, 1);
 * 
 * // With strict typing (typescript will error if types mismatch)
 * eq(users.firstName, 'Ada');
 */
export function eq<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function eq(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number | boolean): BinaryExpressionNode;
export function eq(left: OperandNode | ColumnRef | TypedLike<unknown>, right: OperandNode | ColumnRef | string | number | boolean | TypedLike<unknown>): BinaryExpressionNode {
  return createBinaryExpression('=', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number | boolean);
}

/**
 * Creates a not equal expression (`left != right`).
 * 
 * @param left - The left operand (column or value).
 * @param right - The right operand (column or value).
 * @returns A `BinaryExpressionNode` representing the inequality check.
 * 
 * @example
 * neq(users.status, 'inactive');
 */
export function neq<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function neq(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number | boolean): BinaryExpressionNode;
export function neq(
  left: OperandNode | ColumnRef | TypedLike<unknown>,
  right: OperandNode | ColumnRef | string | number | boolean | TypedLike<unknown>
): BinaryExpressionNode {
  return createBinaryExpression('!=', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number | boolean);
}

/**
 * Creates a greater-than expression (`left > right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * gt(users.age, 18);
 */
export function gt<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function gt(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode;
export function gt(left: OperandNode | ColumnRef | TypedLike<unknown>, right: OperandNode | ColumnRef | string | number | TypedLike<unknown>): BinaryExpressionNode {
  return createBinaryExpression('>', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number);
}

/**
 * Creates a greater-than-or-equal expression (`left >= right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * gte(users.score, 100);
 */
export function gte<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function gte(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode;
export function gte(left: OperandNode | ColumnRef | TypedLike<unknown>, right: OperandNode | ColumnRef | string | number | TypedLike<unknown>): BinaryExpressionNode {
  return createBinaryExpression('>=', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number);
}

/**
 * Creates a less-than expression (`left < right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * lt(inventory.stock, 5);
 */
export function lt<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function lt(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode;
export function lt(left: OperandNode | ColumnRef | TypedLike<unknown>, right: OperandNode | ColumnRef | string | number | TypedLike<unknown>): BinaryExpressionNode {
  return createBinaryExpression('<', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number);
}

/**
 * Creates a less-than-or-equal expression (`left <= right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * lte(products.price, 50.00);
 */
export function lte<T>(left: TypedLike<T>, right: T | TypedLike<T>): BinaryExpressionNode;
export function lte(left: OperandNode | ColumnRef, right: OperandNode | ColumnRef | string | number): BinaryExpressionNode;
export function lte(left: OperandNode | ColumnRef | TypedLike<unknown>, right: OperandNode | ColumnRef | string | number | TypedLike<unknown>): BinaryExpressionNode {
  return createBinaryExpression('<=', left as OperandNode | ColumnRef, right as OperandNode | ColumnRef | string | number);
}

/**
 * Creates a `LIKE` pattern matching expression.
 * 
 * @param left - The column or expression to check.
 * @param pattern - The pattern string (e.g., 'A%').
 * @param escape - Optional escape character.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * like(users.email, '%@gmail.com');
 */
export const like = (left: OperandNode | ColumnRef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('LIKE', left, pattern, escape);

/**
 * Creates a `NOT LIKE` pattern matching expression.
 * 
 * @param left - The column or expression to check.
 * @param pattern - The pattern string.
 * @param escape - Optional escape character.
 * @returns A `BinaryExpressionNode`.
 * 
 * @example
 * notLike(users.email, 'test%');
 */
export const notLike = (left: OperandNode | ColumnRef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('NOT LIKE', left, pattern, escape);

/**
 * Creates a logical AND expression to combine multiple conditions.
 * 
 * @param operands - One or more conditions to combine.
 * @returns A `LogicalExpressionNode`.
 * 
 * @example
 * and(
 *   eq(users.isActive, true),
 *   gt(users.age, 18)
 * );
 */
export const and = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'AND',
  operands
});

/**
 * Creates a logical OR expression to combine multiple conditions.
 * 
 * @param operands - One or more conditions to combine.
 * @returns A `LogicalExpressionNode`.
 * 
 * @example
 * or(
 *   eq(users.role, 'admin'),
 *   eq(users.role, 'moderator')
 * );
 */
export const or = (...operands: ExpressionNode[]): LogicalExpressionNode => ({
  type: 'LogicalExpression',
  operator: 'OR',
  operands
});

/**
 * Creates an IS NULL check (`left IS NULL`).
 * 
 * @param left - The operand to check.
 * @returns A `NullExpressionNode`.
 * 
 * @example
 * isNull(users.deletedAt);
 */
export const isNull = (left: OperandNode | ColumnRef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toOperandNode(left),
  operator: 'IS NULL'
});

/**
 * Creates an IS NOT NULL check (`left IS NOT NULL`).
 * 
 * @param left - The operand to check.
 * @returns A `NullExpressionNode`.
 * 
 * @example
 * isNotNull(users.email);
 */
export const isNotNull = (left: OperandNode | ColumnRef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toOperandNode(left),
  operator: 'IS NOT NULL'
});

const createInExpression = (
  operator: 'IN' | 'NOT IN',
  left: OperandNode | ColumnRef,
  right: InExpressionRight
): InExpressionNode => ({
  type: 'InExpression',
  left: toOperandNode(left),
  operator,
  right
});

/**
 * Creates an IN list check (`left IN (v1, v2, ...)`).
 * 
 * @param left - The operand to check.
 * @param values - An array of values to check against.
 * @returns An `InExpressionNode`.
 * 
 * @example
 * inList(users.status, ['active', 'pending']);
 */
export const inList = (left: OperandNode | ColumnRef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('IN', left, values.map(v => toOperand(v)));

/**
 * Creates a NOT IN list check (`left NOT IN (v1, v2, ...)`).
 * 
 * @param left - The operand to check.
 * @param values - An array of values to check against.
 * @returns An `InExpressionNode`.
 * 
 * @example
 * notInList(users.id, [1, 2, 3]);
 */
export const notInList = (left: OperandNode | ColumnRef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('NOT IN', left, values.map(v => toOperand(v)));

/**
 * Creates an IN subquery check (`left IN (SELECT ...)`).
 * 
 * @param left - The operand to check.
 * @param subquery - The subquery to run.
 * @returns An `InExpressionNode`.
 * 
 * @example
 * inSubquery(
 *   posts.authorId,
 *   selectFromEntity(User).select({ id: users.id }).where(eq(users.isActive, true))
 * );
 */
export const inSubquery = (left: OperandNode | ColumnRef, subquery: SelectQueryInput): InExpressionNode =>
  createInExpression('IN', left, toScalarSubqueryNode(subquery));

/**
 * Creates a NOT IN subquery check (`left NOT IN (SELECT ...)`).
 * 
 * @param left - The operand to check.
 * @param subquery - The subquery to run.
 * @returns An `InExpressionNode`.
 * 
 * @example
 * notInSubquery(
 *   users.id,
 *   selectFromEntity(Blacklist).select({ userId: blacklist.userId })
 * );
 */
export const notInSubquery = (left: OperandNode | ColumnRef, subquery: SelectQueryInput): InExpressionNode =>
  createInExpression('NOT IN', left, toScalarSubqueryNode(subquery));

const createBetweenExpression = (
  operator: 'BETWEEN' | 'NOT BETWEEN',
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => ({
  type: 'BetweenExpression',
  left: toOperandNode(left),
  operator,
  lower: toOperand(lower),
  upper: toOperand(upper)
});

/**
 * Creates a BETWEEN check (`left BETWEEN lower AND upper`).
 * 
 * @param left - The operand to check.
 * @param lower - The lower bound (inclusive).
 * @param upper - The upper bound (inclusive).
 * @returns A `BetweenExpressionNode`.
 * 
 * @example
 * between(products.price, 10, 100);
 */
export const between = (
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => createBetweenExpression('BETWEEN', left, lower, upper);

/**
 * Creates a NOT BETWEEN check (`left NOT BETWEEN lower AND upper`).
 * 
 * @param left - The operand to check.
 * @param lower - The lower bound (inclusive).
 * @param upper - The upper bound (inclusive).
 * @returns A `BetweenExpressionNode`.
 * 
 * @example
 * notBetween(users.age, 20, 30);
 */
export const notBetween = (
  left: OperandNode | ColumnRef,
  lower: OperandNode | ColumnRef | string | number,
  upper: OperandNode | ColumnRef | string | number
): BetweenExpressionNode => createBetweenExpression('NOT BETWEEN', left, lower, upper);

const createArithmeticExpression = (
  operator: '+' | '-' | '*' | '/',
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): ArithmeticExpressionNode => ({
  type: 'ArithmeticExpression',
  left: toOperand(left),
  operator,
  right: toOperand(right)
});

/**
 * Creates an addition expression (`left + right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns An `ArithmeticExpressionNode`.
 */
export const add = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): ArithmeticExpressionNode => createArithmeticExpression('+', left, right);

/**
 * Creates a subtraction expression (`left - right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns An `ArithmeticExpressionNode`.
 */
export const sub = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): ArithmeticExpressionNode => createArithmeticExpression('-', left, right);

/**
 * Creates a multiplication expression (`left * right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns An `ArithmeticExpressionNode`.
 */
export const mul = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): ArithmeticExpressionNode => createArithmeticExpression('*', left, right);

/**
 * Creates a division expression (`left / right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns An `ArithmeticExpressionNode`.
 */
export const div = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): ArithmeticExpressionNode => createArithmeticExpression('/', left, right);

const createBitwiseExpression = (
  operator: BitwiseOperator,
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => ({
  type: 'BitwiseExpression',
  left: toOperand(left),
  operator,
  right: toOperand(right)
});

/**
 * Creates a bitwise AND expression (`left & right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BitwiseExpressionNode`.
 */
export const bitAnd = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => createBitwiseExpression('&', left, right);

/**
 * Creates a bitwise OR expression (`left | right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BitwiseExpressionNode`.
 */
export const bitOr = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => createBitwiseExpression('|', left, right);

/**
 * Creates a bitwise XOR expression (`left ^ right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A `BitwiseExpressionNode`.
 */
export const bitXor = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => createBitwiseExpression('^', left, right);

/**
 * Creates a bitwise left-shift expression (`left << right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand (number of bits).
 * @returns A `BitwiseExpressionNode`.
 */
export const shiftLeft = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => createBitwiseExpression('<<', left, right);

/**
 * Creates a bitwise right-shift expression (`left >> right`).
 * 
 * @param left - The left operand.
 * @param right - The right operand (number of bits).
 * @returns A `BitwiseExpressionNode`.
 */
export const shiftRight = (
  left: OperandNode | ColumnRef,
  right: OperandNode | ColumnRef | string | number
): BitwiseExpressionNode => createBitwiseExpression('>>', left, right);

/**
 * Creates a JSON path extraction expression.
 * 
 * @param col - The source column (should be a JSON/JSONB column).
 * @param path - The JSON path expression (e.g., '$.address.city').
 * @returns A `JsonPathNode`.
 * 
 * @example
 * jsonPath(users.profile, '$.settings.theme');
 */
export const jsonPath = (col: ColumnRef | ColumnNode, path: string): JsonPathNode => ({
  type: 'JsonPath',
  column: columnOperand(col),
  path
});

/**
 * Creates a CASE expression (`CASE WHEN ... THEN ... ELSE ... END`).
 * 
 * @param conditions - An array of `{ when, then }` objects.
 * @param elseValue - Optional value for the `ELSE` clause.
 * @returns A `CaseExpressionNode`.
 * 
 * @example
 * caseWhen([
 *   { when: gt(users.age, 65), then: 'Senior' },
 *   { when: gt(users.age, 18), then: 'Adult' }
 * ], 'Minor');
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
 * Creates a CAST expression (`CAST(expression AS type)`).
 * 
 * @param expression - The expression to cast.
 * @param castType - The target SQL type (e.g., 'VARCHAR', 'INTEGER').
 * @returns A `CastExpressionNode`.
 * 
 * @example
 * cast(users.age, 'VARCHAR');
 */
export const cast = (
  expression: OperandNode | ColumnRef | string | number | boolean | null,
  castType: string
): CastExpressionNode => ({
  type: 'Cast',
  expression: toOperand(expression),
  castType
});

/**
 * Creates an EXISTS check (`EXISTS (SELECT ...)`).
 * 
 * @param subquery - The subquery to check.
 * @returns An `ExistsExpressionNode`.
 * 
 * @example
 * exists(
 *   selectFromEntity(Order).where(eq(orders.userId, users.id))
 * );
 */
export const exists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'EXISTS',
  subquery
});

/**
 * Creates a NOT EXISTS check (`NOT EXISTS (SELECT ...)`).
 * 
 * @param subquery - The subquery to check.
 * @returns An `ExistsExpressionNode`.
 * 
 * @example
 * notExists(
 *   selectFromEntity(Subscription).where(eq(subscriptions.userId, users.id))
 * );
 */
export const notExists = (subquery: SelectQueryNode): ExistsExpressionNode => ({
  type: 'ExistsExpression',
  operator: 'NOT EXISTS',
  subquery
});

/**
 * Creates a COLLATE expression (`expression COLLATE collation`).
 * 
 * @param expression - The expression string.
 * @param collation - The collation name (e.g., 'nocase').
 * @returns A `CollateExpressionNode`.
 * 
 * @example
 * collate(users.email, 'nocase');
 */
export const collate = (
  expression: OperandNode | ColumnRef | string | number | boolean | null,
  collation: string
): CollateExpressionNode => ({
  type: 'Collate',
  expression: toOperand(expression),
  collation
});
