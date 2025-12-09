import { TableDef } from '../schema/table.js';
import { Entity } from '../schema/types.js';
import { hydrateRows } from './hydration.js';
import { OrmSession } from './orm-session.ts';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { createEntityProxy, createEntityFromRow } from './entity.js';
import { EntityContext } from './entity-context.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';

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
  entityCtx: EntityContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> => {
  const ast = qb.getAST();
  const compiled = entityCtx.dialect.compileSelect(ast);
  const executed = await entityCtx.executor.executeSql(compiled.sql, compiled.params);
  const rows = flattenResults(executed);

  if (ast.setOps && ast.setOps.length > 0) {
    return rows.map(row => createEntityProxy(entityCtx, qb.getTable(), row, qb.getLazyRelations()));
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row => createEntityFromRow(entityCtx, qb.getTable(), row, qb.getLazyRelations()));
};

export async function executeHydrated<TTable extends TableDef>(
  session: OrmSession,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  return executeWithEntityContext(session, qb);
}

export async function executeHydratedWithContexts<TTable extends TableDef>(
  _execCtx: ExecutionContext,
  hydCtx: HydrationContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  const entityCtx = hydCtx.entityContext;
  if (!entityCtx) {
    throw new Error('Hydration context is missing an EntityContext');
  }
  return executeWithEntityContext(entityCtx, qb);
}
