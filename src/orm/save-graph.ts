import type { EntityInstance } from '../schema/types.js';
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

export interface SaveGraphOptions {
  /** Remove existing collection members that are not present in the payload */
  pruneMissing?: boolean;
}

type AnyEntity = Record<string, any>;

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const pickColumns = (table: TableDef, payload: AnyEntity): Record<string, any> => {
  const columns: Record<string, any> = {};
  for (const key of Object.keys(table.columns)) {
    if (payload[key] !== undefined) {
      columns[key] = payload[key];
    }
  }
  return columns;
};

const ensureEntity = <TTable extends TableDef>(
  session: OrmSession,
  table: TTable,
  payload: AnyEntity
): EntityInstance<TTable> => {
  const pk = findPrimaryKey(table);
  const row = pickColumns(table, payload);
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

const assignColumns = (table: TableDef, entity: AnyEntity, payload: AnyEntity): void => {
  for (const key of Object.keys(table.columns)) {
    if (payload[key] !== undefined) {
      entity[key] = payload[key];
    }
  }
};

const isEntityInCollection = (items: AnyEntity[], pkName: string, entity: AnyEntity): boolean => {
  if (items.includes(entity)) return true;
  const entityPk = entity[pkName];
  if (entityPk === undefined || entityPk === null) return false;
  return items.some(item => toKey(item[pkName]) === toKey(entityPk));
};

const findInCollectionByPk = (items: AnyEntity[], pkName: string, pkValue: any): AnyEntity | undefined => {
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
  const collection = root[relationName];
  await collection.load();

  const targetTable = relation.target;
  const targetPk = findPrimaryKey(targetTable);
  const existing = collection.getItems();
  const seen = new Set<string>();

  for (const item of payload) {
    if (item === null || item === undefined) continue;
    const asObj = typeof item === 'object' ? (item as AnyEntity) : { [targetPk]: item };
    const pkValue = asObj[targetPk];

    const current =
      findInCollectionByPk(existing, targetPk, pkValue) ??
      (pkValue !== undefined && pkValue !== null ? session.getEntity(targetTable, pkValue) : undefined);

    const entity = current ?? ensureEntity(session, targetTable, asObj);
    assignColumns(targetTable, entity, asObj);
    await applyGraphToEntity(session, targetTable, entity, asObj, options);

    if (!isEntityInCollection(collection.getItems(), targetPk, entity)) {
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
  const ref = root[relationName];
  if (payload === undefined) return;
  if (payload === null) {
    ref.set(null);
    return;
  }
  const pk = findPrimaryKey(relation.target);
  if (typeof payload === 'number' || typeof payload === 'string') {
    const entity = ref.set({ [pk]: payload });
    if (entity) {
      await applyGraphToEntity(session, relation.target, entity, { [pk]: payload }, options);
    }
    return;
  }
  const attached = ref.set(payload as AnyEntity);
  if (attached) {
    await applyGraphToEntity(session, relation.target, attached, payload as AnyEntity, options);
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
  const ref = root[relationName];
  if (payload === undefined) return;
  if (payload === null) {
    ref.set(null);
    return;
  }
  const pk = relation.localKey || findPrimaryKey(relation.target);
  if (typeof payload === 'number' || typeof payload === 'string') {
    const entity = ref.set({ [pk]: payload });
    if (entity) {
      await applyGraphToEntity(session, relation.target, entity, { [pk]: payload }, options);
    }
    return;
  }
  const attached = ref.set(payload as AnyEntity);
  if (attached) {
    await applyGraphToEntity(session, relation.target, attached, payload as AnyEntity, options);
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
  const collection = root[relationName];
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
      ? session.getEntity(targetTable, pkValue) ?? ensureEntity(session, targetTable, asObj)
      : ensureEntity(session, targetTable, asObj);

    assignColumns(targetTable, entity, asObj);
    await applyGraphToEntity(session, targetTable, entity, asObj, options);

    if (!isEntityInCollection(collection.getItems(), targetPk, entity)) {
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
  assignColumns(table, entity, payload);

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

  const root = ensureEntity<TTable>(session, table as TTable, payload);
  await applyGraphToEntity(session, table, root, payload, options);
  return root;
};
