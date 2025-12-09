import { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { RelationChange, RelationKey, TrackedEntity } from './runtime-types.js';

export interface EntityContext {
    dialect: Dialect;
    executor: DbExecutor;

    getEntity(table: TableDef, pk: any): any;
    setEntity(table: TableDef, pk: any, entity: any): void;

    trackNew(table: TableDef, entity: any, pk?: any): void;
    trackManaged(table: TableDef, pk: any, entity: any): void;

    markDirty(entity: any): void;
    markRemoved(entity: any): void;

    getEntitiesForTable(table: TableDef): TrackedEntity[];

    registerRelationChange(
        root: any,
        relationKey: RelationKey,
        rootTable: TableDef,
        relationName: string,
        relation: RelationDef,
        change: RelationChange<any>
    ): void;
}
