import { TableDef } from '../schema/table.js';
import { EntityInstance } from '../schema/types.js';
import type { EntityContext, PrimaryKey } from './entity-context.js';
import { ENTITY_META, EntityMeta, RelationKey } from './entity-meta.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../query-builder/relation-types.js';
import { populateHydrationCache } from './entity-hydration.js';
import { getRelationWrapper, RelationEntityFactory } from './entity-relations.js';

export { relationLoaderCache } from './entity-relation-cache.js';

/**
 * Creates an entity proxy with lazy loading capabilities.
 * @template TTable - The table type
 * @template TLazy - The lazy relation keys
 * @param ctx - The entity context
 * @param table - The table definition
 * @param row - The database row
 * @param lazyRelations - Optional lazy relations
 * @returns The entity instance
 */
export const createEntityProxy = <
  TTable extends TableDef,
  TLazy extends RelationKey<TTable> = RelationKey<TTable>
>(
  ctx: EntityContext,
  table: TTable,
  row: Record<string, unknown>,
  lazyRelations: TLazy[] = [] as TLazy[],
  lazyRelationOptions: Map<string, RelationIncludeOptions> = new Map()
): EntityInstance<TTable> => {
  const target: Record<string, unknown> = { ...row };
  const meta: EntityMeta<TTable> = {
    ctx,
    table,
    lazyRelations: [...lazyRelations],
    lazyRelationOptions: new Map(lazyRelationOptions),
    relationCache: new Map(),
    relationHydration: new Map(),
    relationWrappers: new Map()
  };

  const createRelationEntity: RelationEntityFactory = (relationTable, relationRow) =>
    createEntityFromRow(meta.ctx, relationTable, relationRow);

  Object.defineProperty(target, ENTITY_META, {
    value: meta,
    enumerable: false,
    writable: false
  });

  const handler: ProxyHandler<object> = {
    get(targetObj, prop, receiver) {
      if (prop === ENTITY_META) {
        return meta;
      }

      if (prop === '$load') {
        return async (relationName: RelationKey<TTable>) => {
          const wrapper = getRelationWrapper(meta, relationName, receiver, createRelationEntity);
          if (wrapper && typeof wrapper.load === 'function') {
            return wrapper.load();
          }
          return undefined;
        };
      }

      if (typeof prop === 'string' && table.relations[prop]) {
        return getRelationWrapper(meta, prop as RelationKey<TTable>, receiver, createRelationEntity);
      }

      return Reflect.get(targetObj, prop, receiver);
    },

    set(targetObj, prop, value, receiver) {
      const result = Reflect.set(targetObj, prop, value, receiver);
      if (typeof prop === 'string' && table.columns[prop]) {
        ctx.markDirty(receiver);
      }
      return result;
    }
  };

  const proxy = new Proxy(target, handler) as EntityInstance<TTable>;
  populateHydrationCache(proxy, row, meta);
  return proxy;
};

/**
 * Creates an entity instance from a database row.
 * @template TTable - The table type
 * @template TResult - The result type
 * @param ctx - The entity context
 * @param table - The table definition
 * @param row - The database row
 * @param lazyRelations - Optional lazy relations
 * @returns The entity instance
 */
export const createEntityFromRow = <
  TTable extends TableDef,
  TResult extends EntityInstance<TTable> = EntityInstance<TTable>
>(
  ctx: EntityContext,
  table: TTable,
  row: Record<string, unknown>,
  lazyRelations: RelationKey<TTable>[] = [],
  lazyRelationOptions: Map<string, RelationIncludeOptions> = new Map()
): TResult => {
  const pkName = findPrimaryKey(table);
  const pkValue = row[pkName];
  if (pkValue !== undefined && pkValue !== null) {
    const tracked = ctx.getEntity(table, pkValue as PrimaryKey);
    if (tracked) return tracked as TResult;
  }

  const entity = createEntityProxy(ctx, table, row, lazyRelations, lazyRelationOptions);
  if (pkValue !== undefined && pkValue !== null) {
    ctx.trackManaged(table, pkValue as PrimaryKey, entity);
  } else {
    ctx.trackNew(table, entity);
  }

  return entity as TResult;
};
