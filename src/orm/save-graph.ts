import type {
  EntityInstance,
  HasManyCollection,
  HasOneReference,
  BelongsToReference,
  ManyToManyCollection
} from '../schema/types.js';
import { normalizeColumnType, type ColumnDef } from '../schema/column-types.js';
import {
  RelationKinds,
  type BelongsToManyRelation,
  type BelongsToRelation,
  type HasManyRelation,
  type HasOneRelation,
  type RelationDef
} from '../schema/relation.js';
import type { TableDef } from '../schema/table.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { createEntityFromRow } from './entity.js';
import type { EntityConstructor } from './entity-metadata.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';
import type { OrmSession } from './orm-session.js';

/**
 * Options for controlling the behavior of save graph operations.
 */
export interface SaveGraphOptions {
  /** Remove existing collection members that are not present in the payload */
  pruneMissing?: boolean;
  /**
   * Coerce JSON-friendly input values into DB-friendly primitives.
   * Currently:
   * - Date -> ISO string (for DATE/DATETIME/TIMESTAMP/TIMESTAMPTZ columns)
   */
  coerce?: 'json';
}

/** Represents an entity object with arbitrary properties. */

/** Represents an entity object with arbitrary properties. */

type AnyEntity = Record<string, unknown>;

/**

 * Converts a value to a string key, returning an empty string for null or undefined.

 * @param value - The value to convert.

 * @returns The string representation or empty string.

 */

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const coerceColumnValue = (
  table: TableDef,
  columnName: string,
  value: unknown,
  options: SaveGraphOptions
): unknown => {
  if (options.coerce !== 'json') return value;
  if (value === null || value === undefined) return value;

  const column = table.columns[columnName] as unknown as ColumnDef | undefined;
  if (!column) return value;

  const normalized = normalizeColumnType(column.type);

  const isDateLikeColumn =
    normalized === 'date' ||
    normalized === 'datetime' ||
    normalized === 'timestamp' ||
    normalized === 'timestamptz';

  if (isDateLikeColumn && value instanceof Date) {
    return value.toISOString();
  }

  // Future coercions can be added here based on `normalized`.
  return value;
};

const pickColumns = (table: TableDef, payload: AnyEntity, options: SaveGraphOptions): Record<string, unknown> => {
  const columns: Record<string, unknown> = {};
  for (const key of Object.keys(table.columns)) {
    if (payload[key] !== undefined) {
      columns[key] = coerceColumnValue(table, key, payload[key], options);
    }
  }
  return columns;
};

const ensureEntity = <TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  payload: AnyEntity,
  options: SaveGraphOptions
): EntityInstance<TTable> => {
  const pk = findPrimaryKey(table);
  const row = pickColumns(table, payload, options);
  const pkValue = payload[pk];

  if (pkValue !== undefined && pkValue !== null) {
    const tracked = session.getEntity(table, pkValue);
    if (tracked) {
      return tracked as EntityInstance<TTable>;
    }
    // Seed the stub with PK to track a managed entity when updating.
    if (row[pk] === undefined) {
      row[pk] = pkValue;
    }
  }

  return createEntityFromRow(session, table, row) as EntityInstance<TTable>;
};

const assignColumns = (table: TableDef, entity: AnyEntity, payload: AnyEntity, options: SaveGraphOptions): void => {
  for (const key of Object.keys(table.columns)) {
    if (payload[key] !== undefined) {
      entity[key] = coerceColumnValue(table, key, payload[key], options);
    }
  }
};

const isEntityInCollection = (items: AnyEntity[], pkName: string, entity: AnyEntity): boolean => {
  if (items.includes(entity)) return true;
  const entityPk = entity[pkName];
  if (entityPk === undefined || entityPk === null) return false;
  return items.some(item => toKey(item[pkName]) === toKey(entityPk));
};

const findInCollectionByPk = (items: AnyEntity[], pkName: string, pkValue: unknown): AnyEntity | undefined => {
  if (pkValue === undefined || pkValue === null) return undefined;
  return items.find(item => toKey(item[pkName]) === toKey(pkValue));
};

const handleHasMany = async (
  session: OrmSession,
  root: AnyEntity,
  relationName: string,
  relation: HasManyRelation,
  payload: unknown,
  options: SaveGraphOptions
): Promise<void> => {
  if (!Array.isArray(payload)) return;
  const collection = root[relationName] as unknown as HasManyCollection<unknown>;
  await collection.load();

  const targetTable = relation.target;
  const targetPk = findPrimaryKey(targetTable);
  const existing = collection.getItems() as unknown as AnyEntity[];
  const seen = new Set<string>();

  for (const item of payload) {
    if (item === null || item === undefined) continue;
    const asObj = typeof item === 'object' ? (item as AnyEntity) : { [targetPk]: item };
    const pkValue = asObj[targetPk];

    const current =
      findInCollectionByPk(existing, targetPk, pkValue) ??
      (pkValue !== undefined && pkValue !== null ? session.getEntity(targetTable, pkValue) : undefined);

    const entity = current ?? ensureEntity(session, targetTable, asObj, options);
    assignColumns(targetTable, entity as AnyEntity, asObj, options);
    await applyGraphToEntity(session, targetTable, entity as AnyEntity, asObj, options);

    if (!isEntityInCollection(collection.getItems() as unknown as AnyEntity[], targetPk, entity as unknown as AnyEntity)) {
      collection.attach(entity);
    }

    if (pkValue !== undefined && pkValue !== null) {
      seen.add(toKey(pkValue));
    }
  }

  if (options.pruneMissing) {
    for (const item of [...collection.getItems()]) {
      const pkValue = item[targetPk];
      if (pkValue !== undefined && pkValue !== null && !seen.has(toKey(pkValue))) {
        collection.remove(item);
      }
    }
  }
};

const handleHasOne = async (
  session: OrmSession,
  root: AnyEntity,
  relationName: string,
  relation: HasOneRelation,
  payload: unknown,
  options: SaveGraphOptions
): Promise<void> => {
  const ref = root[relationName] as unknown as HasOneReference<unknown>;
  if (payload === undefined) return;
  if (payload === null) {
    ref.set(null);
    return;
  }
  const pk = findPrimaryKey(relation.target);
  if (typeof payload === 'number' || typeof payload === 'string') {
    const entity = ref.set({ [pk]: payload });
    if (entity) {
      await applyGraphToEntity(session, relation.target, entity as AnyEntity, { [pk]: payload }, options);
    }
    return;
  }
  const attached = ref.set(payload as AnyEntity);
  if (attached) {
    await applyGraphToEntity(session, relation.target, attached as AnyEntity, payload as AnyEntity, options);
  }
};

const handleBelongsTo = async (
  session: OrmSession,
  root: AnyEntity,
  relationName: string,
  relation: BelongsToRelation,
  payload: unknown,
  options: SaveGraphOptions
): Promise<void> => {
  const ref = root[relationName] as unknown as BelongsToReference<unknown>;
  if (payload === undefined) return;
  if (payload === null) {
    ref.set(null);
    return;
  }
  const pk = relation.localKey || findPrimaryKey(relation.target);
  if (typeof payload === 'number' || typeof payload === 'string') {
    const entity = ref.set({ [pk]: payload });
    if (entity) {
      await applyGraphToEntity(session, relation.target, entity as AnyEntity, { [pk]: payload }, options);
    }
    return;
  }
  const attached = ref.set(payload as AnyEntity);
  if (attached) {
    await applyGraphToEntity(session, relation.target, attached as AnyEntity, payload as AnyEntity, options);
  }
};

const handleBelongsToMany = async (
  session: OrmSession,
  root: AnyEntity,
  relationName: string,
  relation: BelongsToManyRelation,
  payload: unknown,
  options: SaveGraphOptions
): Promise<void> => {
  if (!Array.isArray(payload)) return;
  const collection = root[relationName] as unknown as ManyToManyCollection<unknown>;
  await collection.load();

  const targetTable = relation.target;
  const targetPk = relation.targetKey || findPrimaryKey(targetTable);
  const seen = new Set<string>();

  for (const item of payload) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'number' || typeof item === 'string') {
      const id = item;
      collection.attach(id);
      seen.add(toKey(id));
      continue;
    }

    const asObj = item as AnyEntity;
    const pkValue = asObj[targetPk];
    const entity = pkValue !== undefined && pkValue !== null
      ? session.getEntity(targetTable, pkValue) ?? ensureEntity(session, targetTable, asObj, options)
      : ensureEntity(session, targetTable, asObj, options);

    assignColumns(targetTable, entity as AnyEntity, asObj, options);
    await applyGraphToEntity(session, targetTable, entity as AnyEntity, asObj, options);

    if (!isEntityInCollection(collection.getItems() as unknown as AnyEntity[], targetPk, entity as unknown as AnyEntity)) {
      collection.attach(entity);
    }

    if (pkValue !== undefined && pkValue !== null) {
      seen.add(toKey(pkValue));
    }
  }

  if (options.pruneMissing) {
    for (const item of [...collection.getItems()] as unknown as AnyEntity[]) {
      const pkValue = item[targetPk];
      if (pkValue !== undefined && pkValue !== null && !seen.has(toKey(pkValue))) {
        collection.detach(item);
      }
    }
  }
};

const applyRelation = async (
  session: OrmSession,
  table: TableDef,
  entity: AnyEntity,
  relationName: string,
  relation: RelationDef,
  payload: unknown,
  options: SaveGraphOptions
): Promise<void> => {
  switch (relation.type) {
    case RelationKinds.HasMany:
      return handleHasMany(session, entity, relationName, relation, payload, options);
    case RelationKinds.HasOne:
      return handleHasOne(session, entity, relationName, relation, payload, options);
    case RelationKinds.BelongsTo:
      return handleBelongsTo(session, entity, relationName, relation, payload, options);
    case RelationKinds.BelongsToMany:
      return handleBelongsToMany(session, entity, relationName, relation, payload, options);
  }
};

const applyGraphToEntity = async (
  session: OrmSession,
  table: TableDef,
  entity: AnyEntity,
  payload: AnyEntity,
  options: SaveGraphOptions
): Promise<void> => {
  assignColumns(table, entity, payload, options);

  for (const [relationName, relation] of Object.entries(table.relations)) {
    if (!(relationName in payload)) continue;
    await applyRelation(session, table, entity, relationName, relation as RelationDef, payload[relationName], options);
  }
};

export const saveGraph = async <TTable extends TableDef>(
  session: OrmSession,
  entityClass: EntityConstructor,
  payload: AnyEntity,
  options: SaveGraphOptions = {}
): Promise<EntityInstance<TTable>> => {
  const table = getTableDefFromEntity(entityClass);
  if (!table) {
    throw new Error('Entity metadata has not been bootstrapped');
  }

  const root = ensureEntity<TTable>(session, table as TTable, payload, options);
  await applyGraphToEntity(session, table, root as AnyEntity, payload, options);
  return root;
};

/**

 * Internal version of saveGraph with typed return based on the constructor.

 * @param session - The ORM session.

 * @param entityClass - The entity constructor.

 * @param payload - The payload data for the root entity and its relations.

 * @param options - Options for the save operation.

 * @returns The root entity instance.

 */

export const saveGraphInternal = async <TCtor extends EntityConstructor>(

  session: OrmSession,

  entityClass: TCtor,

  payload: AnyEntity,

  options: SaveGraphOptions = {}

): Promise<InstanceType<TCtor>> => {

  const table = getTableDefFromEntity(entityClass);

  if (!table) {

    throw new Error('Entity metadata has not been bootstrapped');

  }

  const root = ensureEntity(session, table, payload, options);

  await applyGraphToEntity(session, table, root as AnyEntity, payload, options);

  return root as unknown as InstanceType<TCtor>;

};
