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

type Rows = Record<string, any>[];

const relationLoaderCache = <T extends Map<string, any>>(
  meta: EntityMeta<any>,
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

export const createEntityProxy = <
  TTable extends TableDef,
  TLazy extends keyof RelationMap<TTable> = keyof RelationMap<TTable>
>(
  ctx: EntityContext,
  table: TTable,
  row: Record<string, any>,
  lazyRelations: TLazy[] = [] as TLazy[]
): EntityInstance<TTable> => {
  const target: Record<string, any> = { ...row };
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

  let proxy: EntityInstance<TTable>;
  const handler: ProxyHandler<any> = {
    get(targetObj, prop, receiver) {
      if (prop === ENTITY_META) {
        return meta;
      }

      if (prop === '$load') {
        return async (relationName: keyof RelationMap<TTable>) => {
          const wrapper = getRelationWrapper(meta, relationName as string, proxy);
          if (wrapper && typeof wrapper.load === 'function') {
            return wrapper.load();
          }
          return undefined;
        };
      }

      if (typeof prop === 'string' && table.relations[prop]) {
        return getRelationWrapper(meta, prop, proxy);
      }

      return Reflect.get(targetObj, prop, receiver);
    },

    set(targetObj, prop, value, receiver) {
      const result = Reflect.set(targetObj, prop, value, receiver);
      if (typeof prop === 'string' && table.columns[prop]) {
        ctx.markDirty(proxy);
      }
      return result;
    }
  };

  proxy = new Proxy(target, handler) as EntityInstance<TTable>;
  populateHydrationCache(proxy, row, meta);
  return proxy;
};

export const createEntityFromRow = <
  TTable extends TableDef,
  TResult extends EntityInstance<TTable> = EntityInstance<TTable>
>(
  ctx: EntityContext,
  table: TTable,
  row: Record<string, any>,
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

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const populateHydrationCache = <TTable extends TableDef>(
  entity: any,
  row: Record<string, any>,
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
      const cache = new Map<string, Record<string, any>>();
      cache.set(toKey(rootValue), data as Record<string, any>);
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
      const cache = new Map<string, Record<string, any>>();
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

const getRelationWrapper = (
  meta: EntityMeta<any>,
  relationName: string,
  owner: any
): HasManyCollection<any> | HasOneReference<any> | BelongsToReference<any> | ManyToManyCollection<any> | undefined => {
  if (meta.relationWrappers.has(relationName)) {
    return meta.relationWrappers.get(relationName) as HasManyCollection<any>;
  }

  const relation = meta.table.relations[relationName];
  if (!relation) return undefined;

  const wrapper = instantiateWrapper(meta, relationName, relation as any, owner);
  if (wrapper) {
    meta.relationWrappers.set(relationName, wrapper);
  }

  return wrapper;
};

const instantiateWrapper = (
  meta: EntityMeta<any>,
  relationName: string,
  relation: HasManyRelation | HasOneRelation | BelongsToRelation | BelongsToManyRelation,
  owner: any
): HasManyCollection<any> | HasOneReference<any> | BelongsToReference<any> | ManyToManyCollection<any> | undefined => {
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
        (row: Record<string, any>) => createEntityFromRow(meta.ctx, hasOne.target, row),
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
        (row: Record<string, any>) => createEntityFromRow(meta.ctx, relation.target, row),
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
        (row: Record<string, any>) => createEntityFromRow(meta.ctx, relation.target, row),
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
        (row: Record<string, any>) => createEntityFromRow(meta.ctx, relation.target, row),
        localKey
      );
    }
    default:
      return undefined;
  }
};
