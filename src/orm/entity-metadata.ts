import { ColumnDef } from '../schema/column-types.js';
import { defineTable, TableDef, TableHooks } from '../schema/table.js';
import { CascadeMode, RelationKinds } from '../schema/relation.js';

/**
 * Constructor type for entities.
 * Supports any constructor signature for maximum flexibility with decorator-based entities.
 * @template T - The entity type
 */
export type EntityConstructor<T = object> = new (...args: never[]) => T;

/**
 * Target that can be an entity constructor or table definition.
 */
export type EntityOrTableTarget = EntityConstructor | TableDef;

/**
 * Resolver for entity or table target, can be direct or function.
 * @typeParam T - Specific target type that should be resolved
 */
export type EntityOrTableTargetResolver<T extends EntityOrTableTarget = EntityOrTableTarget> =
  T | (() => T);

/**
 * Simplified column definition structure used during metadata registration.
 * @template T - Concrete column definition type being extended
 */
export type ColumnDefLike<T extends ColumnDef = ColumnDef> = Omit<T, 'table'>;

/**
 * Transforms simplified column metadata into full ColumnDef objects during table building.
 * @template TColumns - Mapping of column names to simplified definitions
 */
type MaterializeColumns<TColumns extends Record<string, ColumnDefLike>> = {
  [K in keyof TColumns]: ColumnDef<TColumns[K]['type'], TColumns[K]['tsType']> & Omit<
    TColumns[K],
    'name' | 'table' | 'type' | 'tsType'
  > & { name: string; table: string };
};

/**
 * Common properties shared by all relation metadata types.
 */
interface BaseRelationMetadata {
  /** The property key for the relation */
  propertyKey: string;
  /** The target entity or table */
  target: EntityOrTableTargetResolver;
  /** Optional cascade mode */
  cascade?: CascadeMode;
}

/**
 * Metadata for has many relations.
 */
export interface HasManyRelationMetadata extends BaseRelationMetadata {
  /** The relation kind */
  kind: typeof RelationKinds.HasMany;
  /** The foreign key */
  foreignKey?: string;
  /** Optional local key */
  localKey?: string;
}

/**
 * Metadata for has one relations.
 */
export interface HasOneRelationMetadata extends BaseRelationMetadata {
  /** The relation kind */
  kind: typeof RelationKinds.HasOne;
  /** The foreign key */
  foreignKey?: string;
  /** Optional local key */
  localKey?: string;
}

/**
 * Metadata for belongs to relations.
 */
export interface BelongsToRelationMetadata extends BaseRelationMetadata {
  /** The relation kind */
  kind: typeof RelationKinds.BelongsTo;
  /** The foreign key */
  foreignKey: string;
  /** Optional local key */
  localKey?: string;
}

/**
 * Metadata for belongs to many relations.
 */
export interface BelongsToManyRelationMetadata extends BaseRelationMetadata {
  /** The relation kind */
  kind: typeof RelationKinds.BelongsToMany;
  /** The pivot table */
  pivotTable: EntityOrTableTargetResolver;
  /** The pivot foreign key to root */
  pivotForeignKeyToRoot?: string;
  /** The pivot foreign key to target */
  pivotForeignKeyToTarget?: string;
  /** Optional local key */
  localKey?: string;
  /** Optional target key */
  targetKey?: string;
  /** Optional pivot primary key */
  pivotPrimaryKey?: string;
  /** Optional default pivot columns */
  defaultPivotColumns?: string[];
}

/**
 * Union type for all relation metadata.
 */
export type RelationMetadata =
  | HasManyRelationMetadata
  | HasOneRelationMetadata
  | BelongsToRelationMetadata
  | BelongsToManyRelationMetadata;

/**
 * Metadata for entities.
 * @template TColumns - The columns type
 */
export interface EntityMetadata<TColumns extends Record<string, ColumnDefLike> = Record<string, ColumnDefLike>> {
  /** The entity constructor */
  target: EntityConstructor;
  /** The table name */
  tableName: string;
  /** The columns */
  columns: TColumns;
  /** The relations */
  relations: Record<string, RelationMetadata>;
  /** Optional hooks */
  hooks?: TableHooks;
  /** Optional table definition */
  table?: TableDef<MaterializeColumns<TColumns>>;
}

const metadataMap = new Map<EntityConstructor, EntityMetadata>();

/**
 * Registers entity metadata.
 * @param meta - The entity metadata to register
 */
export const registerEntityMetadata = (meta: EntityMetadata): void => {
  metadataMap.set(meta.target, meta);
};

/**
 * Ensures entity metadata exists for the target, creating it if necessary.
 * @param target - The entity constructor
 * @returns The entity metadata
 */
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

/**
 * Gets entity metadata for the target.
 * @param target - The entity constructor
 * @returns The entity metadata or undefined if not found
 */
export const getEntityMetadata = (target: EntityConstructor): EntityMetadata | undefined => {
  return metadataMap.get(target);
};

/**
 * Gets all entity metadata.
 * @returns Array of all entity metadata
 */
export const getAllEntityMetadata = (): EntityMetadata[] => {
  return Array.from(metadataMap.values());
};

/**
 * Clears all entity metadata.
 */
export const clearEntityMetadata = (): void => {
  metadataMap.clear();
};

/**
 * Adds column metadata to an entity.
 * @param target - The entity constructor
 * @param propertyKey - The property key
 * @param column - The column definition
 */
export const addColumnMetadata = (
  target: EntityConstructor,
  propertyKey: string,
  column: ColumnDefLike
): void => {
  const meta = ensureEntityMetadata(target);
  (meta.columns as Record<string, ColumnDefLike>)[propertyKey] = { ...column };
};

/**
 * Adds relation metadata to an entity.
 * @param target - The entity constructor
 * @param propertyKey - The property key
 * @param relation - The relation metadata
 */
export const addRelationMetadata = (
  target: EntityConstructor,
  propertyKey: string,
  relation: RelationMetadata
): void => {
  const meta = ensureEntityMetadata(target);
  meta.relations[propertyKey] = relation;
};

/**
 * Sets the table name and hooks for an entity.
 * @param target - The entity constructor
 * @param tableName - The table name
 * @param hooks - Optional table hooks
 */
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

/**
 * Builds a table definition from entity metadata.
 * @template TColumns - The columns type
 * @param meta - The entity metadata
 * @returns The table definition
 */
export const buildTableDef = <TColumns extends Record<string, ColumnDefLike>>(meta: EntityMetadata<TColumns>): TableDef<MaterializeColumns<TColumns>> => {
  if (meta.table) {
    return meta.table;
  }

  // Build columns using a simpler approach that avoids type assertion
  const columns: Record<string, ColumnDef> = {};
  for (const [key, def] of Object.entries(meta.columns)) {
    columns[key] = {
      ...def,
      name: def.name ?? key,
      table: meta.tableName
    } as ColumnDef;
  }

  const table = defineTable(meta.tableName, columns as MaterializeColumns<TColumns>, {}, meta.hooks);
  meta.table = table;
  return table;
};

