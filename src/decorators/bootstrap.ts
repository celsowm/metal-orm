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
  EntityOrTableTarget,
  EntityOrTableTargetResolver,
  getAllEntityMetadata,
  getEntityMetadata,
  RelationMetadata
} from '../orm/entity-metadata.js';

import { tableRef, type TableRef } from '../schema/table.js';
import {
  SelectableKeys,
  ColumnDef,
  HasManyCollection,
  HasOneReference,
  BelongsToReference,
  ManyToManyCollection
} from '../schema/types.js';

const unwrapTarget = (target: EntityOrTableTargetResolver): EntityOrTableTarget => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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

const buildRelationDefinitions = (
  meta: { relations: Record<string, RelationMetadata> },
  tableMap: Map<EntityConstructor, TableDef>
): Record<string, RelationDef> => {
  const relations: Record<string, RelationDef> = {};

  for (const [name, relation] of Object.entries(meta.relations)) {
    switch (relation.kind) {
      case RelationKinds.HasOne: {
        relations[name] = hasOne(
          resolveTableTarget(relation.target, tableMap),
          relation.foreignKey,
          relation.localKey,
          relation.cascade
        );
        break;
      }
      case RelationKinds.HasMany: {
        relations[name] = hasMany(
          resolveTableTarget(relation.target, tableMap),
          relation.foreignKey,
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
        relations[name] = belongsToMany(
          resolveTableTarget(relation.target, tableMap),
          resolveTableTarget(relation.pivotTable, tableMap),
          {
            pivotForeignKeyToRoot: relation.pivotForeignKeyToRoot,
            pivotForeignKeyToTarget: relation.pivotForeignKeyToTarget,
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

  for (const meta of metas) {
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
  TableDef<{ [K in SelectableKeys<TEntity>]: ColumnDef }> & {
    relations: {
      [K in RelationKeys<TEntity>]:
        NonNullable<TEntity[K]> extends HasManyCollection<infer TChild>
          ? HasManyRelation<EntityTable<NonNullable<TChild> & object>>
          : NonNullable<TEntity[K]> extends ManyToManyCollection<infer TTarget>
            ? BelongsToManyRelation<EntityTable<NonNullable<TTarget> & object>>
            : NonNullable<TEntity[K]> extends HasOneReference<infer TChild>
              ? HasOneRelation<EntityTable<NonNullable<TChild> & object>>
              : NonNullable<TEntity[K]> extends BelongsToReference<infer TParent>
                ? BelongsToRelation<EntityTable<NonNullable<TParent> & object>>
                : NonNullable<TEntity[K]> extends object
                  ? BelongsToRelation<EntityTable<NonNullable<TEntity[K]> & object>>
                  : never;
    };
  };

export const selectFromEntity = <TEntity extends object>(
  ctor: EntityConstructor<TEntity>
): SelectQueryBuilder<unknown, EntityTable<TEntity>> => {
  const table = getTableDefFromEntity(ctor);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return new SelectQueryBuilder(table as unknown as EntityTable<TEntity>);
};

/**
 * Public API: opt-in ergonomic entity reference (decorator-level).
 *
 * Lazily bootstraps entity metadata (via getTableDefFromEntity) and returns a
 * `tableRef(...)`-style proxy so users can write `u.id` instead of `u.columns.id`.
 */
export const entityRef = <TTable extends TableDef = TableDef>(
  ctor: EntityConstructor
): TableRef<TTable> => {
  const table = getTableDefFromEntity<TTable>(ctor);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return tableRef(table);
};
