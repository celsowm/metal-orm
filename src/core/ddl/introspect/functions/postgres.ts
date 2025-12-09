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

export const pgGetExpr = (expr: OperandInput, relid: OperandInput): FunctionNode =>
  fn('pg_get_expr', [expr, relid]);

export const formatType = (typeOid: OperandInput, typmod: OperandInput): FunctionNode =>
  fn('format_type', [typeOid, typmod]);

export default { pgGetExpr, formatType };
