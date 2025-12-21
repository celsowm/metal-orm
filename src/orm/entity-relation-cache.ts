import { TableDef } from '../schema/table.js';
import { EntityMeta, getEntityMeta } from './entity-meta.js';

/**
 * Caches relation loader results across entities of the same type.
 * @template T - The cache type
 * @param meta - The entity metadata
 * @param relationName - The relation name
 * @param factory - The factory function to create the cache
 * @returns Promise with the cached relation data
 */
export const relationLoaderCache = <TTable extends TableDef, T extends Map<string, unknown>>(
  meta: EntityMeta<TTable>,
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
