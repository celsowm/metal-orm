import { SelectQueryBuilder } from '../query-builder/select.js';
import {
  hasMany,
  hasOne,
  belongsTo,
  belongsToMany,
  RelationKinds,
  type RelationDef
} from '../schema/relation.js';
import { TableDef } from '../schema/table.js';
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

const isTableDef = (value: unknown): value is TableDef => {
  return typeof value === 'object' && value !== null && 'columns' in (value as TableDef);
};

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

export const getTableDefFromEntity = <TTable extends TableDef = TableDef>(ctor: EntityConstructor): TTable | undefined => {
  const meta = getEntityMetadata(ctor);
  if (!meta) return undefined;
  if (!meta.table) {
    bootstrapEntities();
  }
  return meta.table as TTable;
};

export const selectFromEntity = <TTable extends TableDef = TableDef>(
  ctor: EntityConstructor
): SelectQueryBuilder<unknown, TTable> => {
  const table = getTableDefFromEntity(ctor);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return new SelectQueryBuilder(table as TTable);
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
