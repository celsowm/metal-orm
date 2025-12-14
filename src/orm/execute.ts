import { TableDef } from '../schema/table.js';
import { EntityInstance } from '../schema/types.js';
import { hydrateRows } from './hydration.js';
import { OrmSession } from './orm-session.ts';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { createEntityProxy, createEntityFromRow } from './entity.js';
import { EntityContext } from './entity-context.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';

type Row = Record<string, unknown>;

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
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<EntityInstance<TTable>[]> => {
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

/**
 * Executes a hydrated query using the ORM session.
 * @template TTable - The table type
 * @param session - The ORM session
 * @param qb - The select query builder
 * @returns Promise resolving to array of entity instances
 */
export async function executeHydrated<TTable extends TableDef>(
  session: OrmSession,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<EntityInstance<TTable>[]> {
  return executeWithEntityContext(session, qb);
}

/**
 * Executes a hydrated query using execution and hydration contexts.
 * @template TTable - The table type
 * @param _execCtx - The execution context (unused)
 * @param hydCtx - The hydration context
 * @param qb - The select query builder
 * @returns Promise resolving to array of entity instances
 */
export async function executeHydratedWithContexts<TTable extends TableDef>(
  _execCtx: ExecutionContext,
  hydCtx: HydrationContext,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<EntityInstance<TTable>[]> {
  const entityCtx = hydCtx.entityContext;
  if (!entityCtx) {
    throw new Error('Hydration context is missing an EntityContext');
  }
  return executeWithEntityContext(entityCtx, qb);
}
