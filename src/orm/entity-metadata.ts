import { ColumnType, ColumnDef } from '../schema/column.js';
import { defineTable, TableDef, TableHooks } from '../schema/table.js';
import { CascadeMode, RelationKinds } from '../schema/relation.js';

export type EntityConstructor<T = object> = new (...args: any[]) => T;
export type EntityOrTableTarget = EntityConstructor<any> | TableDef;
export type EntityOrTableTargetResolver = EntityOrTableTarget | (() => EntityOrTableTarget);

export type ColumnDefLike<T extends ColumnDef = ColumnDef> = Omit<T, 'name' | 'table'>;

type MaterializeColumns<TColumns extends Record<string, ColumnDefLike>> = {
  [K in keyof TColumns]: ColumnDef<TColumns[K]['type'], TColumns[K]['tsType']> & Omit<
    TColumns[K],
    'name' | 'table' | 'type' | 'tsType'
  > & { name: string; table: string };
};

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

export interface EntityMetadata<TColumns extends Record<string, ColumnDefLike> = Record<string, ColumnDefLike>> {
  target: EntityConstructor<any>;
  tableName: string;
  columns: TColumns;
  relations: Record<string, RelationMetadata>;
  hooks?: TableHooks;
  table?: TableDef<MaterializeColumns<TColumns>>;
}

const metadataMap = new Map<EntityConstructor<any>, EntityMetadata>();

export const registerEntityMetadata = (meta: EntityMetadata): void => {
  metadataMap.set(meta.target, meta);
};

export const ensureEntityMetadata = (target: EntityConstructor<any>): EntityMetadata => {
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

export const getEntityMetadata = (target: EntityConstructor<any>): EntityMetadata | undefined => {
  return metadataMap.get(target);
};

export const getAllEntityMetadata = (): EntityMetadata[] => {
  return Array.from(metadataMap.values());
};

export const clearEntityMetadata = (): void => {
  metadataMap.clear();
};

export const addColumnMetadata = (
  target: EntityConstructor<any>,
  propertyKey: string,
  column: ColumnDefLike
): void => {
  const meta = ensureEntityMetadata(target);
  (meta.columns as Record<string, ColumnDefLike>)[propertyKey] = { ...column };
};

export const addRelationMetadata = (
  target: EntityConstructor<any>,
  propertyKey: string,
  relation: RelationMetadata
): void => {
  const meta = ensureEntityMetadata(target);
  meta.relations[propertyKey] = relation;
};

export const setEntityTableName = (
  target: EntityConstructor<any>,
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

export const buildTableDef = <TColumns extends Record<string, ColumnDefLike>>(meta: EntityMetadata<TColumns>): TableDef<MaterializeColumns<TColumns>> => {
  if (meta.table) {
    return meta.table;
  }

  const columns = Object.entries(meta.columns).reduce<MaterializeColumns<TColumns>>((acc, [key, def]) => {
    (acc as any)[key] = {
      ...def,
      name: key,
      table: meta.tableName
    };
    return acc;
  }, {} as MaterializeColumns<TColumns>);

  const table = defineTable(meta.tableName, columns, {}, meta.hooks);
  meta.table = table;
  return table;
};
