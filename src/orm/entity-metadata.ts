import { ColumnType, ColumnDef } from '../schema/column.js';
import { defineTable, TableDef, TableHooks } from '../schema/table.js';
import { CascadeMode, RelationKinds } from '../schema/relation.js';

export type EntityConstructor = new (...args: any[]) => any;
export type EntityOrTableTarget = EntityConstructor | TableDef;
export type EntityOrTableTargetResolver = EntityOrTableTarget | (() => EntityOrTableTarget);

export interface ColumnDefLike {
  type: ColumnType;
  args?: ColumnDef['args'];
  primary?: boolean;
  notNull?: boolean;
}

interface BaseRelationMetadata {
  propertyKey: string;
  target: EntityOrTableTargetResolver;
  cascade?: CascadeMode;
}

export interface HasManyRelationMetadata extends BaseRelationMetadata {
  kind: typeof RelationKinds.HasMany;
  foreignKey: string;
  localKey?: string;
}

export interface HasOneRelationMetadata extends BaseRelationMetadata {
  kind: typeof RelationKinds.HasOne;
  foreignKey: string;
  localKey?: string;
}

export interface BelongsToRelationMetadata extends BaseRelationMetadata {
  kind: typeof RelationKinds.BelongsTo;
  foreignKey: string;
  localKey?: string;
}

export interface BelongsToManyRelationMetadata extends BaseRelationMetadata {
  kind: typeof RelationKinds.BelongsToMany;
  pivotTable: EntityOrTableTargetResolver;
  pivotForeignKeyToRoot: string;
  pivotForeignKeyToTarget: string;
  localKey?: string;
  targetKey?: string;
  pivotPrimaryKey?: string;
  defaultPivotColumns?: string[];
}

export type RelationMetadata =
  | HasManyRelationMetadata
  | HasOneRelationMetadata
  | BelongsToRelationMetadata
  | BelongsToManyRelationMetadata;

export interface EntityMetadata {
  target: EntityConstructor;
  tableName: string;
  columns: Record<string, ColumnDefLike>;
  relations: Record<string, RelationMetadata>;
  hooks?: TableHooks;
  table?: TableDef;
}

const metadataMap = new Map<EntityConstructor, EntityMetadata>();

export const registerEntityMetadata = (meta: EntityMetadata): void => {
  metadataMap.set(meta.target, meta);
};

export const ensureEntityMetadata = (target: EntityConstructor): EntityMetadata => {
  let meta = metadataMap.get(target);
  if (!meta) {
    meta = {
      target,
      tableName: target.name || 'unknown',
      columns: {},
      relations: {}
    };
    metadataMap.set(target, meta);
  }
  return meta;
};

export const getEntityMetadata = (target: EntityConstructor): EntityMetadata | undefined => {
  return metadataMap.get(target);
};

export const getAllEntityMetadata = (): EntityMetadata[] => {
  return Array.from(metadataMap.values());
};

export const clearEntityMetadata = (): void => {
  metadataMap.clear();
};

export const addColumnMetadata = (
  target: EntityConstructor,
  propertyKey: string,
  column: ColumnDefLike
): void => {
  const meta = ensureEntityMetadata(target);
  meta.columns[propertyKey] = { ...column };
};

export const addRelationMetadata = (
  target: EntityConstructor,
  propertyKey: string,
  relation: RelationMetadata
): void => {
  const meta = ensureEntityMetadata(target);
  meta.relations[propertyKey] = relation;
};

export const setEntityTableName = (
  target: EntityConstructor,
  tableName: string,
  hooks?: TableHooks
): void => {
  const meta = ensureEntityMetadata(target);
  if (tableName && tableName.length > 0) {
    meta.tableName = tableName;
  }
  if (hooks) {
    meta.hooks = hooks;
  }
};

export const buildTableDef = (meta: EntityMetadata): TableDef => {
  if (meta.table) {
    return meta.table;
  }

  const columns = Object.entries(meta.columns).reduce<Record<string, ColumnDef>>((acc, [key, def]) => {
    acc[key] = {
      ...def,
      name: key,
      table: meta.tableName
    };
    return acc;
  }, {});

  const table = defineTable(meta.tableName, columns, {}, meta.hooks);
  meta.table = table;
  return table;
};
