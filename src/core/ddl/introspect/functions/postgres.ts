// Small helpers to build Postgres-specific function calls as AST FunctionNodes
import { valueToOperand } from '../../../ast/expression-builders.js';
import type { OperandNode, FunctionNode } from '../../../ast/expression.js';

type OperandInput = OperandNode | string | number | boolean | null;

const toOperand = (v: OperandInput): OperandNode => valueToOperand(v);

const fn = (name: string, args: OperandInput[]): FunctionNode => ({
  type: 'Function',
  name,
  fn: name,
  args: args.map(toOperand)
});

/**
 * Creates a pg_get_expr function call AST node.
 * @param expr - The expression.
 * @param relid - The relation ID.
 * @returns The function node.
 */
export const pgGetExpr = (expr: OperandInput, relid: OperandInput): FunctionNode =>
  fn('pg_get_expr', [expr, relid]);

/**
 * Creates a format_type function call AST node.
 * @param typeOid - The type OID.
 * @param typmod - The type modifier.
 * @returns The function node.
 */
export const formatType = (typeOid: OperandInput, typmod: OperandInput): FunctionNode =>
  fn('format_type', [typeOid, typmod]);

/** Default export with PostgreSQL-specific function helpers. */
export default { pgGetExpr, formatType };
