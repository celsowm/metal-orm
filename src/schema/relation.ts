import type { TableDef } from './table.js';

/**
 * Types of relationships supported between tables
 */
export const RelationKinds = {
    /** One-to-one relationship */
    HasOne: 'HAS_ONE',
    /** One-to-many relationship */
    HasMany: 'HAS_MANY',
    /** Many-to-one relationship */
    BelongsTo: 'BELONGS_TO',
    /** Many-to-many relationship with pivot metadata */
    BelongsToMany: 'BELONGS_TO_MANY',
    /** Polymorphic inverse (child side) */
    MorphTo: 'MORPH_TO',
    /** Polymorphic one-to-one (parent side) */
    MorphOne: 'MORPH_ONE',
    /** Polymorphic one-to-many (parent side) */
    MorphMany: 'MORPH_MANY'
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
 * One-to-one relationship definition
 */
export interface HasOneRelation<TTarget extends TableDef = TableDef> {
    type: typeof RelationKinds.HasOne;
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
export interface BelongsToManyRelation<
  TTarget extends TableDef = TableDef,
  TPivot extends TableDef = TableDef
> {
    type: typeof RelationKinds.BelongsToMany;
    target: TTarget;
    pivotTable: TPivot;
    pivotForeignKeyToRoot: string;
    pivotForeignKeyToTarget: string;
    localKey?: string;
    targetKey?: string;
    pivotPrimaryKey?: string;
    defaultPivotColumns?: string[];
    cascade?: CascadeMode;
}

/**
 * Polymorphic inverse relationship (child side).
 * The child row stores a type + id pair that can point to any of the listed targets.
 */
export interface MorphToRelation<TTargets extends Record<string, TableDef> = Record<string, TableDef>> {
  type: typeof RelationKinds.MorphTo;
  typeField: string;
  idField: string;
  targets: TTargets;
  targetKey?: string;
  cascade?: CascadeMode;
}

/**
 * Polymorphic one-to-one relationship (parent side).
 */
export interface MorphOneRelation<TTarget extends TableDef = TableDef> {
  type: typeof RelationKinds.MorphOne;
  target: TTarget;
  morphName: string;
  typeField: string;
  idField: string;
  typeValue: string;
  localKey?: string;
  cascade?: CascadeMode;
}

/**
 * Polymorphic one-to-many relationship (parent side).
 */
export interface MorphManyRelation<TTarget extends TableDef = TableDef> {
  type: typeof RelationKinds.MorphMany;
  target: TTarget;
  morphName: string;
  typeField: string;
  idField: string;
  typeValue: string;
  localKey?: string;
  cascade?: CascadeMode;
}

/**
 * Union type representing any supported relationship definition
 */
export type RelationDef =
  | HasManyRelation
  | HasOneRelation
  | BelongsToRelation
  | BelongsToManyRelation
  | MorphToRelation
  | MorphOneRelation
  | MorphManyRelation;

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
 * Creates a one-to-one relationship definition
 * @param target - Target table of the relationship
 * @param foreignKey - Foreign key column name on the child table
 * @param localKey - Local key column name (optional)
 * @returns HasOneRelation definition
 */
export const hasOne = <TTarget extends TableDef>(
  target: TTarget,
  foreignKey: string,
  localKey?: string,
  cascade?: CascadeMode
): HasOneRelation<TTarget> => ({
    type: RelationKinds.HasOne,
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
  TTarget extends TableDef,
  TPivot extends TableDef = TableDef
>(
  target: TTarget,
  pivotTable: TPivot,
  options: {
    pivotForeignKeyToRoot: string;
    pivotForeignKeyToTarget: string;
    localKey?: string;
    targetKey?: string;
    pivotPrimaryKey?: string;
    defaultPivotColumns?: string[];
    cascade?: CascadeMode;
  }
): BelongsToManyRelation<TTarget, TPivot> => ({
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

export const isSingleTargetRelation = (
  rel: RelationDef
): rel is Exclude<RelationDef, MorphToRelation> =>
  rel.type !== RelationKinds.MorphTo;

export const isMorphRelation = (rel: RelationDef): rel is
  MorphToRelation | MorphOneRelation | MorphManyRelation =>
  rel.type === RelationKinds.MorphTo ||
  rel.type === RelationKinds.MorphOne ||
  rel.type === RelationKinds.MorphMany;

export const morphTo = <TTargets extends Record<string, TableDef>>(opts: {
  typeField: string;
  idField: string;
  targets: TTargets;
  targetKey?: string;
  cascade?: CascadeMode;
}): MorphToRelation<TTargets> => ({
  type: RelationKinds.MorphTo,
  ...opts
});

export const morphOne = <TTarget extends TableDef>(target: TTarget, opts: {
  as: string;
  typeValue: string;
  localKey?: string;
  typeField?: string;
  idField?: string;
  cascade?: CascadeMode;
}): MorphOneRelation<TTarget> => ({
  type: RelationKinds.MorphOne,
  target,
  morphName: opts.as,
  typeField: opts.typeField ?? `${opts.as}Type`,
  idField: opts.idField ?? `${opts.as}Id`,
  typeValue: opts.typeValue,
  localKey: opts.localKey,
  cascade: opts.cascade
});

export const morphMany = <TTarget extends TableDef>(target: TTarget, opts: {
  as: string;
  typeValue: string;
  localKey?: string;
  typeField?: string;
  idField?: string;
  cascade?: CascadeMode;
}): MorphManyRelation<TTarget> => ({
  type: RelationKinds.MorphMany,
  target,
  morphName: opts.as,
  typeField: opts.typeField ?? `${opts.as}Type`,
  idField: opts.idField ?? `${opts.as}Id`,
  typeValue: opts.typeValue,
  localKey: opts.localKey,
  cascade: opts.cascade
});
