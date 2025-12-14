import { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { RelationChange, RelationKey, TrackedEntity } from './runtime-types.js';

export interface EntityContext {
    dialect: Dialect;
    executor: DbExecutor;

    getEntity(table: TableDef, pk: unknown): unknown;
    setEntity(table: TableDef, pk: unknown, entity: unknown): void;

    trackNew(table: TableDef, entity: unknown, pk?: unknown): void;
    trackManaged(table: TableDef, pk: unknown, entity: unknown): void;

    markDirty(entity: unknown): void;
    markRemoved(entity: unknown): void;

    getEntitiesForTable(table: TableDef): TrackedEntity[];

    registerRelationChange(
        root: unknown,
        relationKey: RelationKey,
        rootTable: TableDef,
        relationName: string,
        relation: RelationDef,
        change: RelationChange<unknown>
    ): void;
}
