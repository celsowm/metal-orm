import { TableDef } from '../schema/table.js';
import { Entity } from '../schema/types.js';
import { hydrateRows } from './hydration.js';
import { OrmContext } from './orm-context.js';
import { OrmSession } from './orm-session.ts';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { createEntityFromRow, createEntityProxy } from './entity.js';
import {
  createEntityContextFromExecutionAndHydration,
  createEntityContextFromOrmContext,
  EntityContext
} from './entity-context.js';

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

const executeWithEntityContext = async <TTable extends TableDef>(
  execCtx: ExecutionContext,
  entityCtx: EntityContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> => {
  const ast = qb.getAST();
  const compiled = execCtx.dialect.compileSelect(ast);
  const executed = await execCtx.executor.executeSql(compiled.sql, compiled.params);
  const rows = flattenResults(executed);

  if (ast.setOps && ast.setOps.length > 0) {
    return rows.map(row =>
      createEntityProxy(entityCtx, qb.getTable(), row, qb.getLazyRelations())
    );
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row =>
    createEntityFromRow(entityCtx, qb.getTable(), row, qb.getLazyRelations())
  );
};

export async function executeHydrated<TTable extends TableDef>(
  ctx: OrmContext | OrmSession,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  if (ctx instanceof OrmSession) {
    const execCtx = ctx.getExecutionContext();
    const hydCtx = ctx.getHydrationContext();
    return executeHydratedWithContexts(execCtx, hydCtx, qb);
  }

  const entityCtx = createEntityContextFromOrmContext(ctx);
  return executeWithEntityContext(entityCtx.executionContext, entityCtx, qb);
}

export async function executeHydratedWithContexts<TTable extends TableDef>(
  execCtx: ExecutionContext,
  hydCtx: HydrationContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  const entityCtx = createEntityContextFromExecutionAndHydration(execCtx, hydCtx);
  return executeWithEntityContext(execCtx, entityCtx, qb);
}
