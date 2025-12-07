// Small helpers to build Postgres-specific function calls as AST FunctionNodes
import { columnOperand, valueToOperand } from '../../../ast/expression-builders.js';
import type { OperandNode, FunctionNode } from '../../../ast/expression.js';

type OperandInput = OperandNode | string | number | boolean | null;

const toOperand = (v: OperandInput) => {
  if (v === null) return valueToOperand(null);
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return valueToOperand(v);
  return v as OperandNode;
};

const fn = (name: string, args: OperandInput[]): FunctionNode => ({
  type: 'Function',
  name,
  fn: name,
  args: args.map(toOperand)
});

export const pgGetExpr = (expr: OperandInput, relid: OperandInput): FunctionNode =>
  fn('pg_get_expr', [expr, relid]);

export const formatType = (typeOid: OperandInput, typmod: OperandInput): FunctionNode =>
  fn('format_type', [typeOid, typmod]);

export default { pgGetExpr, formatType };
