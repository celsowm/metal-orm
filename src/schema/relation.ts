import { TableDef } from './table';

export type RelationType = 'HAS_MANY' | 'BELONGS_TO';

export interface RelationDef {
    type: RelationType;
    target: TableDef;
    foreignKey: string; // The column on the child table
    localKey?: string;  // Usually 'id'
}

export const hasMany = (target: TableDef, foreignKey: string, localKey: string = 'id'): RelationDef => ({
    type: 'HAS_MANY',
    target,
    foreignKey,
    localKey
});

export const belongsTo = (target: TableDef, foreignKey: string, localKey: string = 'id'): RelationDef => ({
    type: 'BELONGS_TO',
    target,
    foreignKey,
    localKey
});