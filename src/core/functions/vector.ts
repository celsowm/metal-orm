// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column-types.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode, TypedExpression, asType } from '../ast/expression.js';
import { BinaryExpressionNode, LogicalExpressionNode } from '../ast/expression-nodes.js';
import { SqlOperator } from '../sql/sql.js';

export type VectorMetric =
  | 'cosine'
  | 'euclidean'
  | 'l2'
  | 'dot'
  | 'inner_product'
  | 'manhattan'
  | 'l1';

export type VectorInput =
  | OperandNode
  | ColumnDef
  | number[]
  | Float32Array
  | string;

const isColumnDef = (val: unknown): val is ColumnDef =>
  !!val && typeof val === 'object' && 'type' in val && 'name' in val;

const toOperand = (input: VectorInput): OperandNode => {
  if (isOperandNode(input)) return input;
  if (isColumnDef(input)) return columnOperand(input);

  if (Array.isArray(input) || input instanceof Float32Array) {
    const formatted = `[${Array.from(input).join(', ')}]`;
    return valueToOperand(formatted);
  }

  return valueToOperand(input);
};

const fn = (key: string, args: OperandNode[]): FunctionNode => ({
  type: 'Function',
  name: key,
  fn: key,
  args
});

/**
 * Calculates vector distance using a specific distance metric ('cosine', 'euclidean', 'l2', 'dot', 'inner_product', 'manhattan', 'l1').
 * Compiles to dialect-native vector functions / operators:
 * - SQL Server: VECTOR_DISTANCE('cosine', v1, v2)
 * - MySQL: DISTANCE(v1, v2, 'COSINE')
 * - PostgreSQL: (v1 <=> v2), (v1 <-> v2), (v1 <#> v2), (v1 <~> v2)
 * - SQLite: vec_distance_cosine(v1, v2), vec_distance_L2(v1, v2)
 */
export const vectorDistance = (
  metric: VectorMetric,
  v1: VectorInput,
  v2: VectorInput
): TypedExpression<number> => {
  const metricOp = valueToOperand(metric.toLowerCase());
  return asType<number>(fn('VECTOR_DISTANCE', [metricOp, toOperand(v1), toOperand(v2)]));
};

/**
 * Calculates Cosine distance between two vectors.
 */
export const cosineDistance = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('cosine', v1, v2);

/**
 * Calculates Euclidean (L2) distance between two vectors.
 */
export const l2Distance = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('euclidean', v1, v2);

/**
 * Alias for l2Distance. Calculates Euclidean distance between two vectors.
 */
export const euclideanDistance = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('euclidean', v1, v2);

/**
 * Calculates Inner / Dot product distance between two vectors.
 */
export const innerProduct = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('dot', v1, v2);

/**
 * Alias for innerProduct. Calculates Dot product distance between two vectors.
 */
export const dotProduct = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('dot', v1, v2);

/**
 * Calculates Manhattan (L1) distance between two vectors.
 */
export const l1Distance = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('manhattan', v1, v2);

/**
 * Alias for l1Distance. Calculates Manhattan distance between two vectors.
 */
export const manhattanDistance = (v1: VectorInput, v2: VectorInput): TypedExpression<number> =>
  vectorDistance('manhattan', v1, v2);

/**
 * Builds a SQLite `sqlite-vec` KNN virtual table query predicate:
 * `col MATCH '[...]' AND k = n`
 *
 * @param column - The vector virtual table column to match against.
 * @param vector - The query vector(s) to match (raw array/string is inlined as a literal).
 * @param k - Number of nearest neighbors to return.
 *
 * @example
 * ```ts
 * where(vectorMatch(items.embedding, [0.1, 2, 30], 5))
 * // => "embedding" MATCH '[0.1, 2, 30]' AND k = 5
 * ```
 */
export const vectorMatch = (
  column: VectorInput,
  vector: VectorInput,
  k: number
): LogicalExpressionNode => {
  const match: BinaryExpressionNode = {
    type: 'BinaryExpression',
    left: toOperand(column),
    operator: 'MATCH' as SqlOperator,
    right: toOperand(vector)
  };

  const kNode: BinaryExpressionNode = {
    type: 'BinaryExpression',
    left: valueToOperand('k'),
    operator: '=',
    right: valueToOperand(k)
  };

  return { type: 'LogicalExpression', operator: 'AND', operands: [match, kNode] };
};

