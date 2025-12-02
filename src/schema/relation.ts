import { TableDef } from './table';

export const RelationKinds = {
    HasMany: 'HAS_MANY',
    BelongsTo: 'BELONGS_TO',
} as const;

export type RelationType = (typeof RelationKinds)[keyof typeof RelationKinds];

interface BaseRelation {
    target: TableDef;
    foreignKey: string; // The column on the child table
    localKey?: string;  // Usually 'id'
}

export interface HasManyRelation extends BaseRelation {
    type: typeof RelationKinds.HasMany;
}

export interface BelongsToRelation extends BaseRelation {
    type: typeof RelationKinds.BelongsTo;
}

export type RelationDef = HasManyRelation | BelongsToRelation;

export const hasMany = (target: TableDef, foreignKey: string, localKey: string = 'id'): HasManyRelation => ({
    type: RelationKinds.HasMany,
    target,
    foreignKey,
    localKey,
});

export const belongsTo = (target: TableDef, foreignKey: string, localKey: string = 'id'): BelongsToRelation => ({
    type: RelationKinds.BelongsTo,
    target,
    foreignKey,
    localKey,
});
