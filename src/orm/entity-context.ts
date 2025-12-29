import { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { RelationChange, RelationKey, TrackedEntity } from './runtime-types.js';

export type PrimaryKey = string | number;

/**
 * Interface for entity context providing entity tracking and management.
 */
export interface EntityContext {
    /** The database dialect */
    dialect: Dialect;
    /** The database executor */
    executor: DbExecutor;

    /**
     * Gets an entity by table and primary key.
     * @param table - The table definition
     * @param pk - The primary key value
     * @returns The entity or undefined
     */
    getEntity(table: TableDef, pk: PrimaryKey): object | undefined;

    /**
     * Sets an entity in the context.
     * @param table - The table definition
     * @param pk - The primary key value
     * @param entity - The entity to set
     */
    setEntity(table: TableDef, pk: PrimaryKey, entity: object): void;

    /**
     * Tracks a new entity.
     * @param table - The table definition
     * @param entity - The new entity
     * @param pk - Optional primary key
     */
    trackNew(table: TableDef, entity: object, pk?: PrimaryKey): void;

    /**
     * Tracks a managed entity.
     * @param table - The table definition
     * @param pk - The primary key
     * @param entity - The managed entity
     */
    trackManaged(table: TableDef, pk: PrimaryKey, entity: object): void;

    /**
     * Marks an entity as dirty.
     * @param entity - The entity to mark
     */
    markDirty(entity: object): void;

    /**
     * Marks an entity as removed.
     * @param entity - The entity to mark
     */
    markRemoved(entity: object): void;

    /**
     * Gets all tracked entities for a table.
     * @param table - The table definition
     * @returns Array of tracked entities
     */
    getEntitiesForTable(table: TableDef): TrackedEntity[];

    /**
     * Registers a relation change.
     * @param root - The root entity
     * @param relationKey - The relation key
     * @param rootTable - The root table definition
     * @param relationName - The relation name
     * @param relation - The relation definition
     * @param change - The relation change
     */
    registerRelationChange(
        root: unknown,
        relationKey: RelationKey,
        rootTable: TableDef,
        relationName: string,
        relation: RelationDef,
        change: RelationChange<unknown>
    ): void;
}
