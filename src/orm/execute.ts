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

const executeWithContexts = async <TTable extends TableDef>(
  execCtx: ExecutionContext,
  entityCtx: EntityContext,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<EntityInstance<TTable>[]> => {
  const ast = qb.getAST();
  const compiled = execCtx.dialect.compileSelect(ast);
  const executed = await execCtx.interceptors.run({ sql: compiled.sql, params: compiled.params }, execCtx.executor);
  const rows = flattenResults(executed);
  const lazyRelations = qb.getLazyRelations();
  const lazyRelationOptions = qb.getLazyRelationOptions();

  if (ast.setOps && ast.setOps.length > 0) {
    return rows.map(row => createEntityProxy(entityCtx, qb.getTable(), row, lazyRelations, lazyRelationOptions));
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row => createEntityFromRow(entityCtx, qb.getTable(), row, lazyRelations, lazyRelationOptions));
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
  return executeWithContexts(session.getExecutionContext(), session, qb);
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
  execCtx: ExecutionContext,
  hydCtx: HydrationContext,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<EntityInstance<TTable>[]> {
  const entityCtx = hydCtx.entityContext;
  if (!entityCtx) {
    throw new Error('Hydration context is missing an EntityContext');
  }
  return executeWithContexts(execCtx, entityCtx, qb);
}
