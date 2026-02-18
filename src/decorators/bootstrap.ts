import { SelectQueryBuilder } from '../query-builder/select.js';
import {
  hasMany,
  hasOne,
  belongsTo,
  belongsToMany,
  RelationKinds,
  type HasManyRelation,
  type HasOneRelation,
  type BelongsToRelation,
  type BelongsToManyRelation,
  type RelationDef
} from '../schema/relation.js';
import { TableDef } from '../schema/table.js';
import { isTableDef } from '../schema/table-guards.js';
import {
  buildTableDef,
  EntityConstructor,
  EntityMetadata,
  EntityOrTableTarget,
  EntityOrTableTargetResolver,
  getAllEntityMetadata,
  getEntityMetadata,
  addRelationMetadata,
  addTransformerMetadata,
  type RelationMetadata
} from '../orm/entity-metadata.js';
import { getDecoratorMetadata } from './decorator-metadata.js';

import { tableRef, type TableRef } from '../schema/table.js';
import {
  SelectableKeys,
  ColumnDef,
  HasManyCollection,
  HasOneReference,
  BelongsToReference,
  ManyToManyCollection,
  EntityInstance
} from '../schema/types.js';

const unwrapTarget = (target: EntityOrTableTargetResolver): EntityOrTableTarget => {
  if (typeof target === 'function' && (target as Function).prototype === undefined) {
    return (target as () => EntityOrTableTarget)();
  }
  return target as EntityOrTableTarget;
};

const resolveTableTarget = (
  target: EntityOrTableTargetResolver,
  tableMap: Map<EntityConstructor, TableDef>
): TableDef => {
  const resolved = unwrapTarget(target);
  if (isTableDef(resolved)) {
    return resolved;
  }
  const table = tableMap.get(resolved as EntityConstructor);
  if (!table) {
    throw new Error(`Entity '${(resolved as EntityConstructor).name}' is not registered with decorators`);
  }
  return table;
};

const toSnakeCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-z0-9_]+/gi, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
};

const normalizeEntityName = (value: string): string => {
  const stripped = value.replace(/Entity$/i, '');
  const normalized = toSnakeCase(stripped || value);
  return normalized || 'unknown';
};

const getPivotKeyBaseFromTarget = (target: EntityOrTableTargetResolver): string => {
  const resolved = unwrapTarget(target);
  if (isTableDef(resolved)) {
    return toSnakeCase(resolved.name || 'unknown');
  }
  const ctor = resolved as EntityConstructor;
  return normalizeEntityName(ctor.name || 'unknown');
};

const getPivotKeyBaseFromRoot = (meta: EntityMetadata): string => {
  return normalizeEntityName(meta.target.name || meta.tableName || 'unknown');
};

const buildRelationDefinitions = (
  meta: EntityMetadata,
  tableMap: Map<EntityConstructor, TableDef>
): Record<string, RelationDef> => {
  const relations: Record<string, RelationDef> = {};

  for (const [name, relation] of Object.entries(meta.relations)) {
    switch (relation.kind) {
      case RelationKinds.HasOne: {
        const foreignKey = relation.foreignKey ?? `${getPivotKeyBaseFromRoot(meta)}_id`;
        relations[name] = hasOne(
          resolveTableTarget(relation.target, tableMap),
          foreignKey,
          relation.localKey,
          relation.cascade
        );
        break;
      }
      case RelationKinds.HasMany: {
        const foreignKey = relation.foreignKey ?? `${getPivotKeyBaseFromRoot(meta)}_id`;
        relations[name] = hasMany(
          resolveTableTarget(relation.target, tableMap),
          foreignKey,
          relation.localKey,
          relation.cascade
        );
        break;
      }
      case RelationKinds.BelongsTo: {
        relations[name] = belongsTo(
          resolveTableTarget(relation.target, tableMap),
          relation.foreignKey,
          relation.localKey,
          relation.cascade
        );
        break;
      }
      case RelationKinds.BelongsToMany: {
        const pivotForeignKeyToRoot =
          relation.pivotForeignKeyToRoot ?? `${getPivotKeyBaseFromRoot(meta)}_id`;
        const pivotForeignKeyToTarget =
          relation.pivotForeignKeyToTarget ?? `${getPivotKeyBaseFromTarget(relation.target)}_id`;
        relations[name] = belongsToMany(
          resolveTableTarget(relation.target, tableMap),
          resolveTableTarget(relation.pivotTable, tableMap),
          {
            pivotForeignKeyToRoot,
            pivotForeignKeyToTarget,
            localKey: relation.localKey,
            targetKey: relation.targetKey,
            pivotPrimaryKey: relation.pivotPrimaryKey,
            defaultPivotColumns: relation.defaultPivotColumns,
            cascade: relation.cascade
          }
        );
        break;
      }
    }
  }

  return relations;
};

/**
 * Bootstraps all entities by building their table definitions and relations.
 * @returns An array of table definitions for all bootstrapped entities.
 */
export const bootstrapEntities = (): TableDef[] => {
  const metas = getAllEntityMetadata();
  const tableMap = new Map<EntityConstructor, TableDef>();

  // Process decorator metadata for each entity
  for (const meta of metas) {
    const decoratorMetadata = getDecoratorMetadata(meta.target);
    if (decoratorMetadata?.transformers) {
      for (const { propertyName, metadata } of decoratorMetadata.transformers) {
        addTransformerMetadata(meta.target, propertyName, metadata);
      }
    }

    const table = buildTableDef(meta);
    tableMap.set(meta.target, table);
  }

  for (const meta of metas) {
    const table = meta.table!;
    const relations = buildRelationDefinitions(meta, tableMap);
    table.relations = relations;
  }

  return metas.map(meta => meta.table!) as TableDef[];
};

/**
 * Builds a single RelationDef from RelationMetadata using the current set of
 * already-bootstrapped entity tables as the resolution map.
 */
const resolveSingleRelation = (
  relationName: string,
  relation: RelationMetadata,
  rootMeta: EntityMetadata
): RelationDef => {
  // Build a tableMap from all entities that are already bootstrapped
  const tableMap = new Map<EntityConstructor, TableDef>();
  for (const m of getAllEntityMetadata()) {
    if (m.table) tableMap.set(m.target, m.table);
  }

  switch (relation.kind) {
    case RelationKinds.HasOne: {
      const foreignKey = relation.foreignKey ?? `${getPivotKeyBaseFromRoot(rootMeta)}_id`;
      return hasOne(
        resolveTableTarget(relation.target, tableMap),
        foreignKey,
        relation.localKey,
        relation.cascade
      );
    }
    case RelationKinds.HasMany: {
      const foreignKey = relation.foreignKey ?? `${getPivotKeyBaseFromRoot(rootMeta)}_id`;
      return hasMany(
        resolveTableTarget(relation.target, tableMap),
        foreignKey,
        relation.localKey,
        relation.cascade
      );
    }
    case RelationKinds.BelongsTo: {
      return belongsTo(
        resolveTableTarget(relation.target, tableMap),
        relation.foreignKey,
        relation.localKey,
        relation.cascade
      );
    }
    case RelationKinds.BelongsToMany: {
      const pivotForeignKeyToRoot =
        relation.pivotForeignKeyToRoot ?? `${getPivotKeyBaseFromRoot(rootMeta)}_id`;
      const pivotForeignKeyToTarget =
        relation.pivotForeignKeyToTarget ?? `${getPivotKeyBaseFromTarget(relation.target)}_id`;
      return belongsToMany(
        resolveTableTarget(relation.target, tableMap),
        resolveTableTarget(relation.pivotTable, tableMap),
        {
          pivotForeignKeyToRoot,
          pivotForeignKeyToTarget,
          localKey: relation.localKey,
          targetKey: relation.targetKey,
          pivotPrimaryKey: relation.pivotPrimaryKey,
          defaultPivotColumns: relation.defaultPivotColumns,
          cascade: relation.cascade
        }
      );
    }
    default:
      throw new Error(`Unknown relation kind for relation '${relationName}'`);
  }
};

/**
 * Adds (or replaces) a single named relation on a decorator-based entity at any
 * time — before or after `bootstrapEntities()` has been called.
 *
 * - Always writes the metadata into the entity's `EntityMetadata.relations` so
 *   that a future bootstrap will include it.
 * - If the entity table has already been built, the resolved `RelationDef` is
 *   also patched directly into `table.relations` so the change is immediately
 *   visible to query builders and hydration.
 *
 * @param ctor     - The entity class decorated with `@Entity`
 * @param name     - The relation property name (key used in `.include()`)
 * @param relation - Relation metadata in the same format as decorators expect
 *
 * @example
 * ```ts
 * // Same options as @HasMany decorator, usable at runtime
 * addEntityRelation(User, 'comments', {
 *   kind: RelationKinds.HasMany,
 *   propertyKey: 'comments',
 *   target: () => Comment,
 *   foreignKey: 'user_id',
 * });
 * ```
 */
export const addEntityRelation = (
  ctor: EntityConstructor,
  name: string,
  relation: RelationMetadata
): void => {
  // Check registration BEFORE auto-creating metadata via addRelationMetadata
  const meta = getEntityMetadata(ctor);
  if (!meta) {
    throw new Error(`Entity '${ctor.name}' is not registered. Did you decorate it with @Entity?`);
  }

  // 1. Write to the decorator-layer metadata store (survives a future bootstrap)
  addRelationMetadata(ctor, name, relation);

  // 2. If the table is already built, patch it immediately
  if (meta.table) {
    meta.table.relations[name] = resolveSingleRelation(name, relation, meta);
  }
};

/**
 * Gets the table definition for a given entity constructor.
 * Bootstraps entities if necessary.
 * @param ctor - The entity constructor.
 * @returns The table definition or undefined if not found.
 */
export const getTableDefFromEntity = <TTable extends TableDef = TableDef>(ctor: EntityConstructor): TTable | undefined => {
  const meta = getEntityMetadata(ctor);
  if (!meta) return undefined;
  if (!meta.table) {
    bootstrapEntities();
  }
  if (!meta.table) {
    throw new Error(`Failed to build table definition for entity '${ctor.name}'`);
  }
  return meta.table as TTable;
};

/**
 * Creates a select query builder for the given entity.
 * @param ctor - The entity constructor.
 * @returns A select query builder for the entity.
 */
type NonFunctionKeys<T> = {
  [K in keyof T]-?: T[K] extends (...args: unknown[]) => unknown ? never : K
}[keyof T];

type RelationKeys<TEntity extends object> =
  Exclude<NonFunctionKeys<TEntity>, SelectableKeys<TEntity>> & string;

type EntityTable<TEntity extends object> =
  Omit<TableDef<{ [K in SelectableKeys<TEntity>]: ColumnDef }>, 'relations'> & {
    relations: {
      [K in RelationKeys<TEntity>]:
      NonNullable<TEntity[K]> extends HasManyCollection<infer TChild>
      ? HasManyRelation<EntityTable<NonNullable<TChild> & object>>
      : NonNullable<TEntity[K]> extends ManyToManyCollection<infer TTarget, infer TPivot>
      ? BelongsToManyRelation<
        EntityTable<NonNullable<TTarget> & object>,
        TPivot extends object ? EntityTable<NonNullable<TPivot> & object> : TableDef
      >
      : NonNullable<TEntity[K]> extends HasOneReference<infer TChild>
      ? HasOneRelation<EntityTable<NonNullable<TChild> & object>>
      : NonNullable<TEntity[K]> extends BelongsToReference<infer TParent>
      ? BelongsToRelation<EntityTable<NonNullable<TParent> & object>>
      : NonNullable<TEntity[K]> extends object
      ? BelongsToRelation<EntityTable<NonNullable<TEntity[K]> & object>>
      : never;
    };
  };

export type DecoratedEntityInstance<TEntity extends object> =
  TEntity & EntityInstance<EntityTable<TEntity>>;

export const selectFromEntity = <TEntity extends object>(
  ctor: EntityConstructor<TEntity>
): SelectQueryBuilder<DecoratedEntityInstance<TEntity>, EntityTable<TEntity>> => {
  const table = getTableDefFromEntity(ctor);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return new SelectQueryBuilder(
    table as unknown as EntityTable<TEntity>,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    ctor
  );
};

/**
 * Public API: opt-in ergonomic entity reference (decorator-level).
 *
 * Lazily bootstraps entity metadata (via getTableDefFromEntity) and returns a
 * `tableRef(...)`-style proxy so users can write `u.id` instead of `u.columns.id`.
 */
export const entityRef = <TEntity extends object>(
  ctor: EntityConstructor<TEntity>
): TableRef<EntityTable<TEntity>> => {
  const table = getTableDefFromEntity(ctor);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return tableRef(table as EntityTable<TEntity>);
};

type EntityRefsTuple<T extends readonly EntityConstructor<object>[]> = {
  [K in keyof T]: T[K] extends EntityConstructor<infer TEntity>
  ? TableRef<EntityTable<TEntity & object>>
  : never;
};

/**
 * Public API: variadic entity references.
 * Usage:
 *   const [u, p] = entityRefs(User, Post);
 */
export const entityRefs = <T extends readonly EntityConstructor<object>[]>(
  ...ctors: T
): EntityRefsTuple<T> => {
  return ctors.map(ctor => entityRef(ctor)) as EntityRefsTuple<T>;
};
