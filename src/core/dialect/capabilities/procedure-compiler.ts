import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { CompiledQuery } from '../abstract.js';

export interface CompiledProcedureCall extends CompiledQuery {
  outParams: {
    source: 'none' | 'firstResultSet' | 'lastResultSet';
    names: string[];
  };
}

/**
 * Optional dialect capability for stored-procedure compilation.
 *
 * Dialects that do not support procedures simply do not implement this
 * interface; unsupported behavior is resolved at the capability boundary
 * rather than through mandatory methods that only throw.
 */
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
