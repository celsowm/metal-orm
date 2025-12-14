import { TableDef } from '../schema/table.js';
import { EntityContext } from './entity-context.js';
import { RelationMap } from '../schema/types.js';

/**
 * Symbol used to store entity metadata on entity instances
 */
export const ENTITY_META = Symbol('EntityMeta');

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * Metadata stored on entity instances for ORM internal use
 * @typeParam TTable - Table definition type
 */
export interface EntityMeta<TTable extends TableDef> {
  /** Entity context */
  ctx: EntityContext;
  /** Table definition */
  table: TTable;
  /** Relations that should be loaded lazily */
  lazyRelations: (keyof RelationMap<TTable>)[];
  /** Cache for relation promises */
  relationCache: Map<string, Promise<unknown>>;
  /** Hydration data for relations */
  relationHydration: Map<string, Map<string, unknown>>;
  /** Relation wrapper instances */
  relationWrappers: Map<string, unknown>;
}

/**
 * Gets hydration rows for a specific relation and key
 * @param meta - Entity metadata
 * @param relationName - Name of the relation
 * @param key - Key to look up in the hydration map
 * @returns Array of hydration rows or undefined if not found
 * @typeParam TTable - Table definition type
 */
export const getHydrationRows = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: string,
  key: unknown
): Record<string, any>[] | undefined => {
  const map = meta.relationHydration.get(relationName);
  if (!map) return undefined;
  const rows = map.get(toKey(key));
  if (!rows) return undefined;
  return Array.isArray(rows) ? rows : undefined;
};

/**
 * Gets a single hydration record for a specific relation and key
 * @param meta - Entity metadata
 * @param relationName - Name of the relation
 * @param key - Key to look up in the hydration map
 * @returns Single hydration record or undefined if not found
 * @typeParam TTable - Table definition type
 */
export const getHydrationRecord = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: string,
  key: unknown
): Record<string, any> | undefined => {
  const map = meta.relationHydration.get(relationName);
  if (!map) return undefined;
  const value = map.get(toKey(key));
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

/**
 * Gets entity metadata from an entity instance
 * @param entity - Entity instance to get metadata from
 * @returns Entity metadata or undefined if not found
 * @typeParam TTable - Table definition type
 */
export const getEntityMeta = <TTable extends TableDef>(entity: unknown): EntityMeta<TTable> | undefined => {
  if (!entity || typeof entity !== 'object') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entity as any)[ENTITY_META];
};

/**
 * Checks if an entity has metadata attached
 * @param entity - Entity instance to check
 * @returns True if the entity has metadata, false otherwise
 */
export const hasEntityMeta = (entity: unknown): entity is { [ENTITY_META]: EntityMeta<TableDef> } => {
  return Boolean(getEntityMeta(entity));
};
