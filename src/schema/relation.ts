import { TableDef } from './table';

/**
 * Types of relationships supported between tables
 */
export const RelationKinds = {
    /** One-to-many relationship */
    HasMany: 'HAS_MANY',
    /** Many-to-one relationship */
    BelongsTo: 'BELONGS_TO',
    /** Many-to-many relationship with pivot metadata */
    BelongsToMany: 'BELONGS_TO_MANY'
} as const;

/**
 * Type representing the supported relationship kinds
 */
export type RelationType = (typeof RelationKinds)[keyof typeof RelationKinds];

export type CascadeMode = 'none' | 'all' | 'persist' | 'remove' | 'link';

/**
 * One-to-many relationship definition
 */
export interface HasManyRelation<TTarget extends TableDef = TableDef> {
    type: typeof RelationKinds.HasMany;
    target: TTarget;
    foreignKey: string;
    localKey?: string;
    cascade?: CascadeMode;
}

/**
 * Many-to-one relationship definition
 */
export interface BelongsToRelation<TTarget extends TableDef = TableDef> {
    type: typeof RelationKinds.BelongsTo;
    target: TTarget;
    foreignKey: string;
    localKey?: string;
    cascade?: CascadeMode;
}

/**
 * Many-to-many relationship definition with rich pivot metadata
 */
export interface BelongsToManyRelation<TTarget extends TableDef = TableDef> {
    type: typeof RelationKinds.BelongsToMany;
    target: TTarget;
    pivotTable: TableDef;
    pivotForeignKeyToRoot: string;
    pivotForeignKeyToTarget: string;
    localKey?: string;
    targetKey?: string;
    pivotPrimaryKey?: string;
    defaultPivotColumns?: string[];
    cascade?: CascadeMode;
}

/**
 * Union type representing any supported relationship definition
 */
export type RelationDef =
  | HasManyRelation
  | BelongsToRelation
  | BelongsToManyRelation;

/**
 * Creates a one-to-many relationship definition
 * @param target - Target table of the relationship
 * @param foreignKey - Foreign key column name on the child table
 * @param localKey - Local key column name (optional)
 * @returns HasManyRelation definition
 *
 * @example
 * ```typescript
 * hasMany(usersTable, 'user_id')
 * ```
 */
export const hasMany = <TTarget extends TableDef>(
  target: TTarget,
  foreignKey: string,
  localKey?: string,
  cascade?: CascadeMode
): HasManyRelation<TTarget> => ({
    type: RelationKinds.HasMany,
    target,
    foreignKey,
    localKey,
    cascade
});

/**
 * Creates a many-to-one relationship definition
 * @param target - Target table of the relationship
 * @param foreignKey - Foreign key column name on the child table
 * @param localKey - Local key column name (optional)
 * @returns BelongsToRelation definition
 *
 * @example
 * ```typescript
 * belongsTo(usersTable, 'user_id')
 * ```
 */
export const belongsTo = <TTarget extends TableDef>(
  target: TTarget,
  foreignKey: string,
  localKey?: string,
  cascade?: CascadeMode
): BelongsToRelation<TTarget> => ({
    type: RelationKinds.BelongsTo,
    target,
    foreignKey,
    localKey,
    cascade
});

/**
 * Creates a many-to-many relationship definition with pivot metadata
 * @param target - Target table
 * @param pivotTable - Intermediate pivot table definition
 * @param options - Pivot metadata configuration
 * @returns BelongsToManyRelation definition
 */
export const belongsToMany = <
  TTarget extends TableDef
>(
  target: TTarget,
  pivotTable: TableDef,
  options: {
    pivotForeignKeyToRoot: string;
    pivotForeignKeyToTarget: string;
    localKey?: string;
    targetKey?: string;
    pivotPrimaryKey?: string;
    defaultPivotColumns?: string[];
    cascade?: CascadeMode;
  }
): BelongsToManyRelation<TTarget> => ({
    type: RelationKinds.BelongsToMany,
    target,
    pivotTable,
    pivotForeignKeyToRoot: options.pivotForeignKeyToRoot,
    pivotForeignKeyToTarget: options.pivotForeignKeyToTarget,
    localKey: options.localKey,
    targetKey: options.targetKey,
    pivotPrimaryKey: options.pivotPrimaryKey,
    defaultPivotColumns: options.defaultPivotColumns,
    cascade: options.cascade
});
