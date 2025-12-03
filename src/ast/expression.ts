import { ColumnDef } from '../schema/column';
import type { SelectQueryNode, OrderByNode } from './query';
import { OrderDirection, SqlOperator } from '../constants/sql';

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
}

/**
 * AST node representing a function call
 */
export interface FunctionNode {
  type: 'Function';
  /** Function name (e.g., COUNT, SUM) */
  name: string;
  /** Function arguments */
  args: (ColumnNode | LiteralNode | JsonPathNode)[];
  /** Optional alias for the function result */
  alias?: string;
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
export type OperandNode = ColumnNode | LiteralNode | FunctionNode | JsonPathNode | ScalarSubqueryNode | CaseExpressionNode | WindowFunctionNode;

/**
 * Converts a primitive or existing operand into an operand node
 * @param value - Value or operand to normalize
 * @returns OperandNode representing the value
 */
export const valueToOperand = (value: unknown): OperandNode => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return { type: 'Literal', value: value === undefined ? null : value } as LiteralNode;
  }
  return value as OperandNode;
};

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

export const isFunctionNode = (node: any): node is FunctionNode => node?.type === 'Function';
export const isCaseExpressionNode = (node: any): node is CaseExpressionNode => node?.type === 'CaseExpression';
export const isWindowFunctionNode = (node: any): node is WindowFunctionNode => node?.type === 'WindowFunction';
export const isExpressionSelectionNode = (
  node: ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode
): node is FunctionNode | CaseExpressionNode | WindowFunctionNode =>
  isFunctionNode(node) || isCaseExpressionNode(node) || isWindowFunctionNode(node);

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
  operator: SqlOperator,
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

/**
 * Creates an equality expression (left = right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with equality operator
 */
export const eq = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('=', left, right);

/**
 * Creates a not equal expression (left != right)
 */
export const neq = (
  left: OperandNode | ColumnDef,
  right: OperandNode | ColumnDef | string | number
): BinaryExpressionNode => createBinaryExpression('!=', left, right);

/**
 * Creates a greater-than expression (left > right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with greater-than operator
 */
export const gt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('>', left, right);

/**
 * Creates a greater than or equal expression (left >= right)
 */
export const gte = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('>=', left, right);

/**
 * Creates a less-than expression (left < right)
 * @param left - Left operand
 * @param right - Right operand
 * @returns Binary expression node with less-than operator
 */
export const lt = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('<', left, right);

/**
 * Creates a less than or equal expression (left <= right)
 */
export const lte = (left: OperandNode | ColumnDef, right: OperandNode | ColumnDef | string | number): BinaryExpressionNode =>
  createBinaryExpression('<=', left, right);

/**
 * Creates a LIKE pattern matching expression
 * @param left - Left operand
 * @param pattern - Pattern to match
 * @param escape - Optional escape character
 * @returns Binary expression node with LIKE operator
 */
export const like = (left: OperandNode | ColumnDef, pattern: string, escape?: string): BinaryExpressionNode =>
  createBinaryExpression('LIKE', left, pattern, escape);

/**
 * Creates a NOT LIKE pattern matching expression
 * @param left - Left operand
 * @param pattern - Pattern to match
 * @param escape - Optional escape character
 * @returns Binary expression node with NOT LIKE operator
 */
export const notLike = (left: OperandNode | ColumnDef, pattern: string, escape?: string): BinaryExpressionNode =>
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
export const isNull = (left: OperandNode | ColumnDef): NullExpressionNode => ({
  type: 'NullExpression',
  left: toNode(left),
  operator: 'IS NULL'
});

/**
 * Creates an IS NOT NULL expression
 * @param left - Operand to check for non-null
 * @returns Null expression node with IS NOT NULL operator
 */
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

/**
 * Creates an IN expression (value IN list)
 * @param left - Operand to check
 * @param values - Values to check against
 * @returns IN expression node
 */
export const inList = (left: OperandNode | ColumnDef, values: (string | number | LiteralNode)[]): InExpressionNode =>
  createInExpression('IN', left, values);

/**
 * Creates a NOT IN expression (value NOT IN list)
 * @param left - Operand to check
 * @param values - Values to check against
 * @returns NOT IN expression node
 */
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

/**
 * Creates a BETWEEN expression (value BETWEEN lower AND upper)
 * @param left - Operand to check
 * @param lower - Lower bound
 * @param upper - Upper bound
 * @returns BETWEEN expression node
 */
export const between = (
  left: OperandNode | ColumnDef,
  lower: OperandNode | ColumnDef | string | number,
  upper: OperandNode | ColumnDef | string | number
): BetweenExpressionNode => createBetweenExpression('BETWEEN', left, lower, upper);

/**
 * Creates a NOT BETWEEN expression (value NOT BETWEEN lower AND upper)
 * @param left - Operand to check
 * @param lower - Lower bound
 * @param upper - Upper bound
 * @returns NOT BETWEEN expression node
 */
export const notBetween = (
  left: OperandNode | ColumnDef,
  lower: OperandNode | ColumnDef | string | number,
  upper: OperandNode | ColumnDef | string | number
): BetweenExpressionNode => createBetweenExpression('NOT BETWEEN', left, lower, upper);

/**
 * Creates a JSON path expression
 * @param col - Source column
 * @param path - JSON path expression
 * @returns JSON path node
 */
export const jsonPath = (col: ColumnDef | ColumnNode, path: string): JsonPathNode => ({
  type: 'JsonPath',
  column: toNode(col) as ColumnNode,
  path
});

/**
 * Creates a COUNT function expression
 * @param col - Column to count
 * @returns Function node with COUNT
 */
export const count = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'COUNT',
  args: [toNode(col) as ColumnNode]
});

/**
 * Creates a SUM function expression
 * @param col - Column to sum
 * @returns Function node with SUM
 */
export const sum = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'SUM',
  args: [toNode(col) as ColumnNode]
});

/**
 * Creates an AVG function expression
 * @param col - Column to average
 * @returns Function node with AVG
 */
export const avg = (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name: 'AVG',
  args: [toNode(col) as ColumnNode]
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

/**
 * Creates a CASE expression
 * @param conditions - Array of WHEN-THEN conditions
 * @param elseValue - Optional ELSE value
 * @returns CASE expression node
 */
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
export const ntile = (n: number): WindowFunctionNode => buildWindowFunction('NTILE', [{ type: 'Literal', value: n }]);

const columnOperand = (col: ColumnDef | ColumnNode): ColumnNode => toNode(col) as ColumnNode;

/**
 * Creates a LAG window function
 * @param col - Column to lag
 * @param offset - Offset (defaults to 1)
 * @param defaultValue - Default value if no row exists
 * @returns Window function node for LAG
 */
export const lag = (col: ColumnDef | ColumnNode, offset: number = 1, defaultValue?: any): WindowFunctionNode => {
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [columnOperand(col), { type: 'Literal', value: offset }];
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
  const args: (ColumnNode | LiteralNode | JsonPathNode)[] = [columnOperand(col), { type: 'Literal', value: offset }];
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
export const firstValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => buildWindowFunction('FIRST_VALUE', [columnOperand(col)]);

/**
 * Creates a LAST_VALUE window function
 * @param col - Column to get last value from
 * @returns Window function node for LAST_VALUE
 */
export const lastValue = (col: ColumnDef | ColumnNode): WindowFunctionNode => buildWindowFunction('LAST_VALUE', [columnOperand(col)]);

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
