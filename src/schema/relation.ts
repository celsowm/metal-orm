import { TableDef } from './table';

/**
 * Types of relationships supported between tables
 */
export const RelationKinds = {
    /** One-to-many relationship */
    HasMany: 'HAS_MANY',
    /** Many-to-one relationship */
    BelongsTo: 'BELONGS_TO',
} as const;

/**
 * Type representing the supported relationship kinds
 */
export type RelationType = (typeof RelationKinds)[keyof typeof RelationKinds];

/**
 * Base properties common to all relationship types
 */
interface BaseRelation {
    /** Target table of the relationship */
    target: TableDef;
    /** Foreign key column name on the child table */
    foreignKey: string;
    /** Local key column name (usually 'id') */
    localKey?: string;
}

/**
 * One-to-many relationship definition
 */
export interface HasManyRelation extends BaseRelation {
    type: typeof RelationKinds.HasMany;
}

/**
 * Many-to-one relationship definition
 */
export interface BelongsToRelation extends BaseRelation {
    type: typeof RelationKinds.BelongsTo;
}

/**
 * Union type representing any supported relationship definition
 */
export type RelationDef = HasManyRelation | BelongsToRelation;

/**
 * Creates a one-to-many relationship definition
 * @param target - Target table of the relationship
 * @param foreignKey - Foreign key column name on the child table
 * @param localKey - Local key column name (defaults to 'id')
 * @returns HasManyRelation definition
 *
 * @example
 * ```typescript
 * hasMany(usersTable, 'user_id')
 * ```
 */
export const hasMany = (target: TableDef, foreignKey: string, localKey: string = 'id'): HasManyRelation => ({
    type: RelationKinds.HasMany,
    target,
    foreignKey,
    localKey,
});

/**
 * Creates a many-to-one relationship definition
 * @param target - Target table of the relationship
 * @param foreignKey - Foreign key column name on the child table
 * @param localKey - Local key column name (defaults to 'id')
 * @returns BelongsToRelation definition
 *
 * @example
 * ```typescript
 * belongsTo(usersTable, 'user_id')
 * ```
 */
export const belongsTo = (target: TableDef, foreignKey: string, localKey: string = 'id'): BelongsToRelation => ({
    type: RelationKinds.BelongsTo,
    target,
    foreignKey,
    localKey,
});
