import { TableDef } from '../schema/table.js';
import { EntityInstance, RelationMap, HasManyCollection, HasOneReference, BelongsToReference, ManyToManyCollection } from '../schema/types.js';
import { EntityContext } from './entity-context.js';
import { ENTITY_META, EntityMeta, getEntityMeta } from './entity-meta.js';
import { DefaultHasManyCollection } from './relations/has-many.js';
import { DefaultHasOneReference } from './relations/has-one.js';
import { DefaultBelongsToReference } from './relations/belongs-to.js';
import { DefaultManyToManyCollection } from './relations/many-to-many.js';
import { HasManyRelation, HasOneRelation, BelongsToRelation, BelongsToManyRelation, RelationKinds } from '../schema/relation.js';
import { loadHasManyRelation, loadHasOneRelation, loadBelongsToRelation, loadBelongsToManyRelation } from './lazy-batch.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';

/**
 * Type representing an array of database rows.
 */
type Rows = Record<string, unknown>[];

/**
 * Caches relation loader results across entities of the same type.
 * @template T - The cache type
 * @param meta - The entity metadata
 * @param relationName - The relation name
 * @param factory - The factory function to create the cache
 * @returns Promise with the cached relation data
 */
const relationLoaderCache = <T extends Map<string, unknown>>(
  meta: EntityMeta<TableDef>,
  relationName: string,
  factory: () => Promise<T>
): Promise<T> => {
  if (meta.relationCache.has(relationName)) {
    return meta.relationCache.get(relationName)! as Promise<T>;
  }

  const promise = factory().then(value => {
    for (const tracked of meta.ctx.getEntitiesForTable(meta.table)) {
      const otherMeta = getEntityMeta(tracked.entity);
      if (!otherMeta) continue;
      otherMeta.relationHydration.set(relationName, value);
    }
    return value;
  });

  meta.relationCache.set(relationName, promise);

  for (const tracked of meta.ctx.getEntitiesForTable(meta.table)) {
    const otherMeta = getEntityMeta(tracked.entity);
    if (!otherMeta) continue;
    otherMeta.relationCache.set(relationName, promise);
  }

  return promise;
};

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
  TLazy extends keyof RelationMap<TTable> = keyof RelationMap<TTable>
>(
  ctx: EntityContext,
  table: TTable,
  row: Record<string, unknown>,
  lazyRelations: TLazy[] = [] as TLazy[]
): EntityInstance<TTable> => {
  const target: Record<string, unknown> = { ...row };
  const meta: EntityMeta<TTable> = {
    ctx,
    table,
    lazyRelations: [...lazyRelations],
    relationCache: new Map(),
    relationHydration: new Map(),
    relationWrappers: new Map()
  };

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
        return async (relationName: keyof RelationMap<TTable>) => {
          const wrapper = getRelationWrapper(meta as unknown as EntityMeta<TableDef>, relationName as string, receiver);
          if (wrapper && typeof wrapper.load === 'function') {
            return wrapper.load();
          }
          return undefined;
        };
      }

      if (typeof prop === 'string' && table.relations[prop]) {
        return getRelationWrapper(meta as unknown as EntityMeta<TableDef>, prop, receiver);
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
  lazyRelations: (keyof RelationMap<TTable>)[] = []
): TResult => {
  const pkName = findPrimaryKey(table);
  const pkValue = row[pkName];
  if (pkValue !== undefined && pkValue !== null) {
    const tracked = ctx.getEntity(table, pkValue);
    if (tracked) return tracked as TResult;
  }

  const entity = createEntityProxy(ctx, table, row, lazyRelations);
  if (pkValue !== undefined && pkValue !== null) {
    ctx.trackManaged(table, pkValue, entity);
  } else {
    ctx.trackNew(table, entity);
  }

  return entity as TResult;
};

/**
 * Converts a value to a string key.
 * @param value - The value to convert
 * @returns String representation of the value
 */
const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * Populates the hydration cache with relation data from the database row.
 * @template TTable - The table type
 * @param entity - The entity instance
 * @param row - The database row
 * @param meta - The entity metadata
 */
const populateHydrationCache = <TTable extends TableDef>(
  entity: Record<string, unknown>,
  row: Record<string, unknown>,
  meta: EntityMeta<TTable>
): void => {
  for (const relationName of Object.keys(meta.table.relations)) {
    const relation = meta.table.relations[relationName];
    const data = row[relationName];
    if (relation.type === RelationKinds.HasOne) {
      const localKey = relation.localKey || findPrimaryKey(meta.table);
      const rootValue = entity[localKey];
      if (rootValue === undefined || rootValue === null) continue;
      if (!data || typeof data !== 'object') continue;
      const cache = new Map<string, Record<string, unknown>>();
      cache.set(toKey(rootValue), data as Record<string, unknown>);
      meta.relationHydration.set(relationName, cache);
      meta.relationCache.set(relationName, Promise.resolve(cache));
      continue;
    }

    if (!Array.isArray(data)) continue;

    if (relation.type === RelationKinds.HasMany || relation.type === RelationKinds.BelongsToMany) {
      const localKey = relation.localKey || findPrimaryKey(meta.table);
      const rootValue = entity[localKey];
      if (rootValue === undefined || rootValue === null) continue;
      const cache = new Map<string, Rows>();
      cache.set(toKey(rootValue), data as Rows);
      meta.relationHydration.set(relationName, cache);
      meta.relationCache.set(relationName, Promise.resolve(cache));
      continue;
    }

    if (relation.type === RelationKinds.BelongsTo) {
      const targetKey = relation.localKey || findPrimaryKey(relation.target);
      const cache = new Map<string, Record<string, unknown>>();
      for (const item of data) {
        const pkValue = item[targetKey];
        if (pkValue === undefined || pkValue === null) continue;
        cache.set(toKey(pkValue), item);
      }
      if (cache.size) {
        meta.relationHydration.set(relationName, cache);
        meta.relationCache.set(relationName, Promise.resolve(cache));
      }
    }
  }
};

const proxifyRelationWrapper = <T extends object>(wrapper: T): T => {
  return new Proxy(wrapper, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }

      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      const getItems = (target as { getItems?: () => unknown }).getItems;
      if (typeof getItems === 'function') {
        const items = getItems.call(target);
        if (items && prop in (items as object)) {
          const value = (items as Record<string, unknown>)[prop as any];
          return typeof value === 'function' ? value.bind(items) : value;
        }
      }

      const getRef = (target as { get?: () => unknown }).get;
      if (typeof getRef === 'function') {
        const current = getRef.call(target);
        if (current && prop in (current as object)) {
          const value = (current as Record<string, unknown>)[prop as any];
          return typeof value === 'function' ? value.bind(current) : value;
        }
      }

      return undefined;
    },

    set(target, prop, value, receiver) {
      if (typeof prop === 'symbol') {
        return Reflect.set(target, prop, value, receiver);
      }

      if (prop in target) {
        return Reflect.set(target, prop, value, receiver);
      }

      const getRef = (target as { get?: () => unknown }).get;
      if (typeof getRef === 'function') {
        const current = getRef.call(target);
        if (current && typeof current === 'object') {
          return Reflect.set(current as object, prop, value);
        }
      }

      const getItems = (target as { getItems?: () => unknown }).getItems;
      if (typeof getItems === 'function') {
        const items = getItems.call(target);
        return Reflect.set(items as object, prop, value);
      }

      return Reflect.set(target, prop, value, receiver);
    }
  });
};

/**
 * Gets a relation wrapper for an entity.
 * @param meta - The entity metadata
 * @param relationName - The relation name
 * @param owner - The owner entity
 * @returns The relation wrapper or undefined
 */
const getRelationWrapper = (
  meta: EntityMeta<TableDef>,
  relationName: string,
  owner: unknown
): HasManyCollection<unknown> | HasOneReference<object> | BelongsToReference<object> | ManyToManyCollection<unknown> | undefined => {
  if (meta.relationWrappers.has(relationName)) {
    return meta.relationWrappers.get(relationName) as HasManyCollection<unknown>;
  }

  const relation = meta.table.relations[relationName];
  if (!relation) return undefined;

  const wrapper = instantiateWrapper(meta, relationName, relation, owner);
  if (!wrapper) return undefined;

  const proxied = proxifyRelationWrapper(wrapper as object);
  meta.relationWrappers.set(relationName, proxied);
  return proxied as HasManyCollection<unknown>;
};

/**
 * Instantiates the appropriate relation wrapper based on relation type.
 * @param meta - The entity metadata
 * @param relationName - The relation name
 * @param relation - The relation definition
 * @param owner - The owner entity
 * @returns The relation wrapper or undefined
 */
const instantiateWrapper = (
  meta: EntityMeta<TableDef>,
  relationName: string,
  relation: HasManyRelation | HasOneRelation | BelongsToRelation | BelongsToManyRelation,
  owner: unknown
): HasManyCollection<unknown> | HasOneReference<object> | BelongsToReference<object> | ManyToManyCollection<unknown> | undefined => {
  switch (relation.type) {
    case RelationKinds.HasOne: {
      const hasOne = relation as HasOneRelation;
      const localKey = hasOne.localKey || findPrimaryKey(meta.table);
      const loader = () => relationLoaderCache(meta, relationName, () =>
        loadHasOneRelation(meta.ctx, meta.table, relationName, hasOne)
      );
      return new DefaultHasOneReference(
        meta.ctx,
        meta,
        owner,
        relationName,
        hasOne,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntityFromRow(meta.ctx, hasOne.target, row),
        localKey
      );
    }
    case RelationKinds.HasMany: {
      const hasMany = relation as HasManyRelation;
      const localKey = hasMany.localKey || findPrimaryKey(meta.table);
      const loader = () => relationLoaderCache(meta, relationName, () =>
        loadHasManyRelation(meta.ctx, meta.table, relationName, hasMany)
      );
      return new DefaultHasManyCollection(
        meta.ctx,
        meta,
        owner,
        relationName,
        hasMany,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntityFromRow(meta.ctx, relation.target, row),
        localKey
      );
    }
    case RelationKinds.BelongsTo: {
      const belongsTo = relation as BelongsToRelation;
      const targetKey = belongsTo.localKey || findPrimaryKey(belongsTo.target);
      const loader = () => relationLoaderCache(meta, relationName, () =>
        loadBelongsToRelation(meta.ctx, meta.table, relationName, belongsTo)
      );
      return new DefaultBelongsToReference(
        meta.ctx,
        meta,
        owner,
        relationName,
        belongsTo,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntityFromRow(meta.ctx, relation.target, row),
        targetKey
      );
    }
    case RelationKinds.BelongsToMany: {
      const many = relation as BelongsToManyRelation;
      const localKey = many.localKey || findPrimaryKey(meta.table);
      const loader = () => relationLoaderCache(meta, relationName, () =>
        loadBelongsToManyRelation(meta.ctx, meta.table, relationName, many)
      );
      return new DefaultManyToManyCollection(
        meta.ctx,
        meta,
        owner,
        relationName,
        many,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntityFromRow(meta.ctx, relation.target, row),
        localKey
      );
    }
    default:
      return undefined;
  }
};
