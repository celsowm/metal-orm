import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { OperandNode } from '../../ast/expression.js';
import type { CompiledQuery, CompilerContext } from '../abstract.js';

export interface CompiledProcedureCall extends CompiledQuery {
  outParams: {
    source: 'none' | 'firstResultSet' | 'lastResultSet';
    names: string[];
  };
}

/** Narrow SQL services consumed by reusable procedure compiler components. */
export interface ProcedureCompilerServices {
  quoteIdentifier(id: string): string;
  createCompilerContext(): CompilerContext;
  compileOperand(node: OperandNode, ctx: CompilerContext): string;
}

/** Optional dialect capability for stored-procedure compilation. */
export interface ProcedureCompiler {
  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall;
}

export const isProcedureCompiler = (value: unknown): value is ProcedureCompiler =>
  typeof (value as { compileProcedureCall?: unknown } | null)?.compileProcedureCall === 'function';

export const requireProcedureCompiler = (value: unknown): ProcedureCompiler => {
  if (!isProcedureCompiler(value)) {
    throw new Error('Stored procedures are not supported by this dialect.');
  }
  return value;
};
