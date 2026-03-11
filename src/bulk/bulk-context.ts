import type { OrmSession } from '../orm/orm-session.js';
import type { ExecutionContext } from '../orm/execution-context.js';
import type { Dialect, CompiledQuery } from '../core/dialect/abstract.js';
import type { ColumnNode } from '../core/ast/expression.js';
import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';
import type { QueryResult } from '../core/execution/db-executor.js';

export interface BulkExecutionContext {
  readonly session: OrmSession;
  readonly executionContext: ExecutionContext;
  readonly dialect: Dialect;
  readonly supportsReturning: boolean;
}

export function createBulkExecutionContext(session: OrmSession): BulkExecutionContext {
  const executionContext = session.getExecutionContext();
  return {
    session,
    executionContext,
    dialect: executionContext.dialect,
    supportsReturning: executionContext.dialect.supportsDmlReturningClause(),
  };
}

export async function executeCompiled(
  ctx: BulkExecutionContext,
  compiled: CompiledQuery
): Promise<QueryResult[]> {
  const payload = await ctx.executionContext.interceptors.run(
    { sql: compiled.sql, params: compiled.params },
    ctx.executionContext.executor
  );
  return extractResultSets(payload);
}

export function extractResultSets(payload: unknown): QueryResult[] {
  const result = payload as { resultSets?: QueryResult[] };
  if (result.resultSets) {
    return result.resultSets;
  }
  return [];
}

export function flattenQueryResults(resultSets: QueryResult[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const rs of resultSets) {
    for (const valueRow of rs.values) {
      const obj: Record<string, unknown> = {};
      rs.columns.forEach((col, idx) => {
        const bare = col.split('.').pop()!.replace(/^["`[\]]+|["`[\]]+$/g, '');
        obj[bare] = valueRow[idx];
      });
      rows.push(obj);
    }
  }
  return rows;
}

export function resolveReturningColumns(
  ctx: BulkExecutionContext,
  table: TableDef,
  returning: boolean | ColumnDef[] | undefined
): ColumnNode[] | undefined {
  if (!returning) return undefined;
  if (!ctx.supportsReturning) return undefined;

  if (returning === true) {
    return Object.values(table.columns).map(col => ({
      type: 'Column' as const,
      table: table.name,
      name: col.name,
      alias: col.name,
    }));
  }

  return returning.map(col => ({
    type: 'Column' as const,
    table: table.name,
    name: col.name,
    alias: col.name,
  }));
}
