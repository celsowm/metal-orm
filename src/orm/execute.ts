import { TableDef } from '../schema/table.js';
import { EntityInstance } from '../schema/types.js';
import { RelationKinds } from '../schema/relation.js';
import { hydrateRows } from './hydration.js';
import { OrmSession } from './orm-session.ts';
import { SelectQueryBuilder } from '../query-builder/select.js';
import {
  createEntityProxy,
  createEntityFromRow,
  relationLoaderCache
} from './entity.js';
import { EntityContext } from './entity-context.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';
import { RelationIncludeOptions } from '../query-builder/relation-types.js';
import { getEntityMeta, RelationKey } from './entity-meta.js';
import { preloadRelationIncludes } from './relation-preload.js';
import {
  loadHasManyRelation,
  loadHasOneRelation,
  loadBelongsToRelation,
  loadBelongsToManyRelation
} from './lazy-batch.js';

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
  const lazyRelations = qb.getLazyRelations() as RelationKey<TTable>[];
  const lazyRelationOptions = qb.getLazyRelationOptions();
  const includeTree = qb.getIncludeTree();

  if (ast.setOps && ast.setOps.length > 0) {
    const proxies = rows.map(row => createEntityProxy(entityCtx, qb.getTable(), row, lazyRelations, lazyRelationOptions));
    await loadLazyRelationsForTable(entityCtx, qb.getTable(), lazyRelations, lazyRelationOptions);
    await preloadRelationIncludes(proxies as Record<string, unknown>[], includeTree);
    return proxies;
  }

  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  const entities = hydrated.map(row => createEntityFromRow(entityCtx, qb.getTable(), row, lazyRelations, lazyRelationOptions));
  await loadLazyRelationsForTable(entityCtx, qb.getTable(), lazyRelations, lazyRelationOptions);
  await preloadRelationIncludes(entities as Record<string, unknown>[], includeTree);
  return entities;
};

const executePlainWithContexts = async <TTable extends TableDef>(
  execCtx: ExecutionContext,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<Record<string, unknown>[]> => {
  const ast = qb.getAST();
  const compiled = execCtx.dialect.compileSelect(ast);
  const executed = await execCtx.interceptors.run({ sql: compiled.sql, params: compiled.params }, execCtx.executor);
  const rows = flattenResults(executed);

  if (ast.setOps && ast.setOps.length > 0) {
    return rows;
  }

  return hydrateRows(rows, qb.getHydrationPlan());
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
 * Executes a hydrated query and returns plain row objects (no entity proxies).
 * @template TTable - The table type
 * @param session - The ORM session
 * @param qb - The select query builder
 * @returns Promise resolving to array of plain row objects
 */
export async function executeHydratedPlain<TTable extends TableDef>(
  session: OrmSession,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<Record<string, unknown>[]> {
  return executePlainWithContexts(session.getExecutionContext(), qb);
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

/**
 * Executes a hydrated query using execution context and returns plain row objects.
 * @template TTable - The table type
 * @param execCtx - The execution context
 * @param qb - The select query builder
 * @returns Promise resolving to array of plain row objects
 */
export async function executeHydratedPlainWithContexts<TTable extends TableDef>(
  execCtx: ExecutionContext,
  qb: SelectQueryBuilder<unknown, TTable>
): Promise<Record<string, unknown>[]> {
  return executePlainWithContexts(execCtx, qb);
}

const loadLazyRelationsForTable = async <TTable extends TableDef>(
  ctx: EntityContext,
  table: TTable,
  lazyRelations: RelationKey<TTable>[],
  lazyRelationOptions: Map<string, RelationIncludeOptions>
): Promise<void> => {
  if (!lazyRelations.length) return;

  const tracked = ctx.getEntitiesForTable(table);
  if (!tracked.length) return;

  const meta = getEntityMeta(tracked[0].entity);
  if (!meta) return;

  for (const relationName of lazyRelations) {
    const relation = table.relations[relationName as string];
    if (!relation) continue;
    const key = relationName as string;
    const options = lazyRelationOptions.get(key);
    if (!options) {
      continue;
    }

    switch (relation.type) {
      case RelationKinds.HasOne:
        await relationLoaderCache(meta, key, () =>
          loadHasOneRelation(ctx, table, key, relation, options)
        );
        break;
      case RelationKinds.HasMany:
        await relationLoaderCache(meta, key, () =>
          loadHasManyRelation(ctx, table, key, relation, options)
        );
        break;
      case RelationKinds.BelongsTo:
        await relationLoaderCache(meta, key, () =>
          loadBelongsToRelation(ctx, table, key, relation, options)
        );
        break;
      case RelationKinds.BelongsToMany:
        await relationLoaderCache(meta, key, () =>
          loadBelongsToManyRelation(ctx, table, key, relation, options)
        );
        break;
    }
  }
};
