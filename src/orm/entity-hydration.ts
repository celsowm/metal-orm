import { TableDef } from '../schema/table.js';
import { RelationKinds } from '../schema/relation.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { EntityMeta } from './entity-meta.js';

/**
 * Type representing an array of database rows.
 */
type Rows = Record<string, unknown>[];

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
export const populateHydrationCache = <TTable extends TableDef>(
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
