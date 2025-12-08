import { TableDef } from '../schema/table.js';
import { Entity } from '../schema/types.js';
import { hydrateRows } from './hydration.js';
import { OrmContext } from './orm-context.js';
import { OrmSession } from './orm-session.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { createEntityFromRow, createEntityProxy } from './entity.js';

type Row = Record<string, any>;

const flattenResults = (results: { columns: string[]; values: unknown[][] }[]): Row[] => {
  const rows: Row[] = [];
  for (const result of results) {
    const { columns, values } = result;
    for (const valueRow of values) {
      const row: Row = {};
      columns.forEach((column, idx) => {
        row[column] = valueRow[idx];
      });
      rows.push(row);
    }
  }
  return rows;
};

// Helper function to get the appropriate context for entity operations
function getEntityContext(ctx: OrmContext | OrmSession): OrmContext {
  if (ctx instanceof OrmSession) {
    // For entity operations, we need to use the session's unitOfWork as the context
    // This is a temporary bridge until we fully refactor entity operations
    return ctx.unitOfWork as unknown as OrmContext;
  }
  return ctx;
}

export async function executeHydrated<TTable extends TableDef>(
  ctx: OrmContext | OrmSession,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  const ast = qb.getAST();

  // Get the appropriate contexts based on what was passed
  const execCtx = ctx instanceof OrmSession ? ctx.getExecutionContext() : ctx;
  const entityCtx = getEntityContext(ctx);

  const compiled = execCtx.dialect.compileSelect(ast);
  const executed = await execCtx.executor.executeSql(compiled.sql, compiled.params);
  const rows = flattenResults(executed);

  // Set-operation queries cannot be reliably hydrated and should not collapse duplicates.
  if (ast.setOps && ast.setOps.length > 0) {
    return rows.map(row =>
      createEntityProxy(entityCtx, qb.getTable(), row, qb.getLazyRelations())
    );
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row =>
    createEntityFromRow(entityCtx, qb.getTable(), row, qb.getLazyRelations())
  );
}

// New version that uses the explicit interfaces
export async function executeHydratedWithContexts<TTable extends TableDef>(
  execCtx: ExecutionContext,
  hydCtx: HydrationContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  const ast = qb.getAST();
  const compiled = execCtx.dialect.compileSelect(ast);
  const executed = await execCtx.executor.executeSql(compiled.sql, compiled.params);
  const rows = flattenResults(executed);

  // Set-operation queries cannot be reliably hydrated and should not collapse duplicates.
  if (ast.setOps && ast.setOps.length > 0) {
    return rows.map(row =>
      createEntityProxy(hydCtx.unitOfWork as unknown as OrmContext, qb.getTable(), row, qb.getLazyRelations())
    );
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row =>
    createEntityFromRow(hydCtx.unitOfWork as unknown as OrmContext, qb.getTable(), row, qb.getLazyRelations())
  );
}
