import { TableDef } from '../schema/table.js';
import { EntityInstance, HasManyCollection, HasOneReference, BelongsToReference, ManyToManyCollection } from '../schema/types.js';
import { EntityMeta, RelationKey } from './entity-meta.js';
import { DefaultHasManyCollection } from './relations/has-many.js';
import { DefaultHasOneReference } from './relations/has-one.js';
import { DefaultBelongsToReference } from './relations/belongs-to.js';
import { DefaultManyToManyCollection } from './relations/many-to-many.js';
import { HasManyRelation, HasOneRelation, BelongsToRelation, BelongsToManyRelation, RelationKinds } from '../schema/relation.js';
import { loadHasManyRelation, loadHasOneRelation, loadBelongsToRelation, loadBelongsToManyRelation } from './lazy-batch.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { relationLoaderCache } from './entity-relation-cache.js';

export type RelationEntityFactory = (
  table: TableDef,
  row: Record<string, unknown>
) => EntityInstance<TableDef>;

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
          const propName = prop as string;
          const value = (items as Record<string, unknown>)[propName];
          return typeof value === 'function' ? value.bind(items) : value;
        }
      }

      const getRef = (target as { get?: () => unknown }).get;
      if (typeof getRef === 'function') {
        const current = getRef.call(target);
        if (current && prop in (current as object)) {
          const propName = prop as string;
          const value = (current as Record<string, unknown>)[propName];
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
 * @param createEntity - The entity factory for relation rows
 * @returns The relation wrapper or undefined
 */
export const getRelationWrapper = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: RelationKey<TTable> | string,
  owner: unknown,
  createEntity: RelationEntityFactory
): HasManyCollection<unknown> | HasOneReference<object> | BelongsToReference<object> | ManyToManyCollection<unknown> | undefined => {
  const relationKey = relationName as string;

  if (meta.relationWrappers.has(relationKey)) {
    return meta.relationWrappers.get(relationKey) as HasManyCollection<unknown>;
  }

  const relation = meta.table.relations[relationKey];
  if (!relation) return undefined;

  const wrapper = instantiateWrapper(meta, relationKey, relation, owner, createEntity);
  if (!wrapper) return undefined;

  const proxied = proxifyRelationWrapper(wrapper as object);
  meta.relationWrappers.set(relationKey, proxied);
  return proxied as HasManyCollection<unknown>;
};

/**
 * Instantiates the appropriate relation wrapper based on relation type.
 * @param meta - The entity metadata
 * @param relationName - The relation name
 * @param relation - The relation definition
 * @param owner - The owner entity
 * @param createEntity - The entity factory for relation rows
 * @returns The relation wrapper or undefined
 */
const instantiateWrapper = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: string,
  relation: HasManyRelation | HasOneRelation | BelongsToRelation | BelongsToManyRelation,
  owner: unknown,
  createEntity: RelationEntityFactory
): HasManyCollection<unknown> | HasOneReference<object> | BelongsToReference<object> | ManyToManyCollection<unknown> | undefined => {
  const metaBase = meta as unknown as EntityMeta<TableDef>;
  const lazyOptions = meta.lazyRelationOptions.get(relationName);
  const loadCached = <T extends Map<string, unknown>>(factory: () => Promise<T>) =>
    relationLoaderCache(metaBase, relationName, factory);
  switch (relation.type) {
    case RelationKinds.HasOne: {
      const hasOne = relation as HasOneRelation;
      const localKey = hasOne.localKey || findPrimaryKey(meta.table);
      const loader = () => loadCached(() =>
        loadHasOneRelation(meta.ctx, meta.table, relationName, hasOne, lazyOptions)
      );
      return new DefaultHasOneReference(
        meta.ctx,
        metaBase,
        owner,
        relationName,
        hasOne,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntity(hasOne.target, row),
        localKey
      );
    }
    case RelationKinds.HasMany: {
      const hasMany = relation as HasManyRelation;
      const localKey = hasMany.localKey || findPrimaryKey(meta.table);
      const loader = () => loadCached(() =>
        loadHasManyRelation(meta.ctx, meta.table, relationName, hasMany, lazyOptions)
      );
      return new DefaultHasManyCollection(
        meta.ctx,
        metaBase,
        owner,
        relationName,
        hasMany,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntity(relation.target, row),
        localKey
      );
    }
    case RelationKinds.BelongsTo: {
      const belongsTo = relation as BelongsToRelation;
      const targetKey = belongsTo.localKey || findPrimaryKey(belongsTo.target);
      const loader = () => loadCached(() =>
        loadBelongsToRelation(meta.ctx, meta.table, relationName, belongsTo, lazyOptions)
      );
      return new DefaultBelongsToReference(
        meta.ctx,
        metaBase,
        owner,
        relationName,
        belongsTo,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntity(relation.target, row),
        targetKey
      );
    }
    case RelationKinds.BelongsToMany: {
      const many = relation as BelongsToManyRelation;
      const localKey = many.localKey || findPrimaryKey(meta.table);
      const loader = () => loadCached(() =>
        loadBelongsToManyRelation(meta.ctx, meta.table, relationName, many, lazyOptions)
      );
      return new DefaultManyToManyCollection(
        meta.ctx,
        metaBase,
        owner,
        relationName,
        many,
        meta.table,
        loader,
        (row: Record<string, unknown>) => createEntity(relation.target, row),
        localKey
      );
    }
    default:
      return undefined;
  }
};
