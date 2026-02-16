import type { ProcedureCallNode } from '../core/ast/procedure.js';
import type { QueryResult } from '../core/execution/db-executor.js';
import { payloadResultSets } from '../core/execution/db-executor.js';
import type { CompiledProcedureCall } from '../core/dialect/abstract.js';
import type { OrmSession } from './orm-session.js';

export interface ProcedureExecutionResult {
  resultSets: QueryResult[];
  out: Record<string, unknown>;
}

const resolveColumnIndex = (columns: string[], expectedName: string): number => {
  const exact = columns.findIndex(column => column === expectedName);
  if (exact >= 0) return exact;

  const lowerExpected = expectedName.toLowerCase();
  return columns.findIndex(column => column.toLowerCase() === lowerExpected);
};

const extractOutValues = (
  compiled: CompiledProcedureCall,
  resultSets: QueryResult[]
): Record<string, unknown> => {
  if (!compiled.outParams.names.length || compiled.outParams.source === 'none') {
    return {};
  }

  const sourceSet =
    compiled.outParams.source === 'firstResultSet'
      ? resultSets[0]
      : resultSets[resultSets.length - 1];

  if (!sourceSet) {
    throw new Error(
      `Procedure expected OUT parameters in ${compiled.outParams.source}, but no result set was returned.`
    );
  }

  if (!sourceSet.values.length) {
    throw new Error(
      `Procedure expected OUT parameters in ${compiled.outParams.source}, but the result set has no rows.`
    );
  }

  const firstRow = sourceSet.values[0];
  const out: Record<string, unknown> = {};
  for (const expectedName of compiled.outParams.names) {
    const columnIndex = resolveColumnIndex(sourceSet.columns, expectedName);
    if (columnIndex < 0) {
      const available = sourceSet.columns.length ? sourceSet.columns.join(', ') : '(none)';
      throw new Error(
        `Procedure OUT parameter "${expectedName}" was not found in ${compiled.outParams.source}. ` +
        `Available columns: ${available}.`
      );
    }
    out[expectedName] = firstRow[columnIndex];
  }
  return out;
};

export const executeProcedureAst = async (
  session: OrmSession,
  ast: ProcedureCallNode
): Promise<ProcedureExecutionResult> => {
  const execCtx = session.getExecutionContext();
  const compiled = execCtx.dialect.compileProcedureCall(ast);
  const payload = await execCtx.interceptors.run(
    { sql: compiled.sql, params: compiled.params },
    execCtx.executor
  );
  const resultSets = payloadResultSets(payload);

  return {
    resultSets,
    out: extractOutValues(compiled, resultSets)
  };
};
