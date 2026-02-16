import { ColumnNode, eq } from '../core/ast/expression.js';
import type { ValueOperandInput } from '../core/ast/expression.js';
import type { Dialect, CompiledQuery } from '../core/dialect/abstract.js';
import { InsertQueryBuilder } from '../query-builder/insert.js';
import { UpdateQueryBuilder } from '../query-builder/update.js';
import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { TableDef, TableHooks } from '../schema/table.js';
import { payloadResultSets } from '../core/execution/db-executor.js';
import type { DbExecutor, QueryResult } from '../core/execution/db-executor.js';
import { IdentityMap } from './identity-map.js';
import { EntityStatus } from './runtime-types.js';
import type { TrackedEntity } from './runtime-types.js';
import type { PrimaryKey } from './entity-context.js';

/**
 * Unit of Work pattern implementation for tracking entity changes.
 */
export class UnitOfWork {
  private readonly trackedEntities = new Map<object, TrackedEntity>();

  /**
   * Creates a new UnitOfWork instance.
   * @param dialect - The database dialect
   * @param executor - The database executor
   * @param identityMap - The identity map
   * @param hookContext - Function to get the hook context
   */
  constructor(
    private readonly dialect: Dialect,
    private readonly executor: DbExecutor,
    private readonly identityMap: IdentityMap,
    private readonly hookContext: () => unknown
  ) { }

  /**
   * Gets the identity buckets map.
   */
  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.identityMap.bucketsMap;
  }

  /**
   * Gets all tracked entities.
   * @returns Array of tracked entities
   */
  getTracked(): TrackedEntity[] {
    return Array.from(this.trackedEntities.values());
  }

  /**
   * Gets an entity by table and primary key.
   * @param table - The table definition
   * @param pk - The primary key value
   * @returns The entity or undefined if not found
   */
  getEntity(table: TableDef, pk: PrimaryKey): object | undefined {
    return this.identityMap.getEntity(table, pk);
  }

  /**
   * Gets all tracked entities for a specific table.
   * @param table - The table definition
   * @returns Array of tracked entities
   */
  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    return this.identityMap.getEntitiesForTable(table);
  }

  /**
   * Finds a tracked entity.
   * @param entity - The entity to find
   * @returns The tracked entity or undefined if not found
   */
  findTracked(entity: object): TrackedEntity | undefined {
    return this.trackedEntities.get(entity);
  }

  /**
   * Sets an entity in the identity map.
   * @param table - The table definition
   * @param pk - The primary key value
   * @param entity - The entity instance
   */
  setEntity(table: TableDef, pk: PrimaryKey, entity: object): void {
    if (pk === null || pk === undefined) return;
    let tracked = this.trackedEntities.get(entity);
    if (!tracked) {
      tracked = {
        table,
        entity,
        pk,
        status: EntityStatus.Managed,
        original: this.createSnapshot(table, entity as Record<string, unknown>)
      };
      this.trackedEntities.set(entity, tracked);
    } else {
      tracked.pk = pk;
    }

    this.registerIdentity(tracked);
  }

  /**
   * Tracks a new entity.
   * @param table - The table definition
   * @param entity - The entity instance
   * @param pk - Optional primary key value
   */
  trackNew(table: TableDef, entity: object, pk?: PrimaryKey): void {
    const tracked: TrackedEntity = {
      table,
      entity,
      pk: pk ?? null,
      status: EntityStatus.New,
      original: null
    };
    this.trackedEntities.set(entity, tracked);
    if (pk != null) {
      this.registerIdentity(tracked);
    }
  }

  /**
   * Tracks a managed entity.
   * @param table - The table definition
   * @param pk - The primary key value
   * @param entity - The entity instance
   */
  trackManaged(table: TableDef, pk: PrimaryKey, entity: object): void {
    const tracked: TrackedEntity = {
      table,
      entity,
      pk,
      status: EntityStatus.Managed,
      original: this.createSnapshot(table, entity as Record<string, unknown>)
    };
    this.trackedEntities.set(entity, tracked);
    this.registerIdentity(tracked);
  }

  /**
   * Marks an entity as dirty (modified).
   * @param entity - The entity to mark as dirty
   */
  markDirty(entity: object): void {
    const tracked = this.trackedEntities.get(entity);
    if (!tracked) return;
    if (tracked.status === EntityStatus.New || tracked.status === EntityStatus.Removed) return;
    tracked.status = EntityStatus.Dirty;
  }

  /**
   * Marks an entity as removed.
   * @param entity - The entity to mark as removed
   */
  markRemoved(entity: object): void {
    const tracked = this.trackedEntities.get(entity);
    if (!tracked) return;
    tracked.status = EntityStatus.Removed;
  }

  /**
   * Flushes pending changes to the database.
   */
  async flush(): Promise<void> {
    const toFlush = Array.from(this.trackedEntities.values());
    for (const tracked of toFlush) {
      switch (tracked.status) {
        case EntityStatus.New:
          await this.flushInsert(tracked);
          break;
        case EntityStatus.Dirty:
          await this.flushUpdate(tracked);
          break;
        case EntityStatus.Removed:
          await this.flushDelete(tracked);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Resets the unit of work by clearing all tracked entities and identity map.
   */
  reset(): void {
    this.trackedEntities.clear();
    this.identityMap.clear();
  }

  /**
   * Flushes an insert operation for a new entity.
   * @param tracked - The tracked entity to insert
   */
  private async flushInsert(tracked: TrackedEntity): Promise<void> {
    await this.runHook(tracked.table.hooks?.beforeInsert, tracked);

    const payload = this.extractColumns(tracked.table, tracked.entity as Record<string, unknown>);
    let builder = new InsertQueryBuilder(tracked.table).values(payload as Record<string, ValueOperandInput>);
    if (this.dialect.supportsDmlReturningClause()) {
      builder = builder.returning(...this.getReturningColumns(tracked.table));
    }
    const compiled = builder.compile(this.dialect);
    const results = await this.executeCompiled(compiled);
    this.applyReturningResults(tracked, results);
    this.applyInsertedIdIfAbsent(tracked, results);

    tracked.status = EntityStatus.Managed;
    tracked.original = this.createSnapshot(tracked.table, tracked.entity as Record<string, unknown>);
    tracked.pk = this.getPrimaryKeyValue(tracked);
    this.registerIdentity(tracked);

    await this.runHook(tracked.table.hooks?.afterInsert, tracked);
  }

  /**
   * Flushes an update operation for a modified entity.
   * @param tracked - The tracked entity to update
   */
  private async flushUpdate(tracked: TrackedEntity): Promise<void> {
    if (tracked.pk == null) return;
    const changes = this.computeChanges(tracked);
    if (!Object.keys(changes).length) {
      tracked.status = EntityStatus.Managed;
      return;
    }

    await this.runHook(tracked.table.hooks?.beforeUpdate, tracked);

    const pkColumn = tracked.table.columns[findPrimaryKey(tracked.table)];
    if (!pkColumn) return;

    let builder = new UpdateQueryBuilder(tracked.table)
      .set(changes)
      .where(eq(pkColumn, tracked.pk));

    if (this.dialect.supportsDmlReturningClause()) {
      builder = builder.returning(...this.getReturningColumns(tracked.table));
    }

    const compiled = builder.compile(this.dialect);
    const results = await this.executeCompiled(compiled);
    this.applyReturningResults(tracked, results);

    tracked.status = EntityStatus.Managed;
    tracked.original = this.createSnapshot(tracked.table, tracked.entity as Record<string, unknown>);
    this.registerIdentity(tracked);

    await this.runHook(tracked.table.hooks?.afterUpdate, tracked);
  }

  /**
   * Flushes a delete operation for a removed entity.
   * @param tracked - The tracked entity to delete
   */
  private async flushDelete(tracked: TrackedEntity): Promise<void> {
    if (tracked.pk == null) return;
    await this.runHook(tracked.table.hooks?.beforeDelete, tracked);

    const pkColumn = tracked.table.columns[findPrimaryKey(tracked.table)];
    if (!pkColumn) return;

    const builder = new DeleteQueryBuilder(tracked.table).where(eq(pkColumn, tracked.pk));
    const compiled = builder.compile(this.dialect);
    await this.executeCompiled(compiled);

    tracked.status = EntityStatus.Detached;
    this.trackedEntities.delete(tracked.entity);
    this.identityMap.remove(tracked);

    await this.runHook(tracked.table.hooks?.afterDelete, tracked);
  }

  /**
   * Runs a table hook if defined.
   * @param hook - The hook function
   * @param tracked - The tracked entity
   */
  private async runHook(
    hook: TableHooks[keyof TableHooks] | undefined,
    tracked: TrackedEntity
  ): Promise<void> {
    if (!hook) return;
    await hook(this.hookContext(), tracked.entity);
  }

  /**
   * Computes changes between current entity state and original snapshot.
   * @param tracked - The tracked entity
   * @returns Object with changed column values
   */
  private computeChanges(tracked: TrackedEntity): Record<string, unknown> {
    const snapshot = tracked.original ?? {};
    const changes: Record<string, unknown> = {};
    for (const column of Object.keys(tracked.table.columns)) {
      const current = (tracked.entity as Record<string, unknown>)[column];
      if (snapshot[column] !== current) {
        changes[column] = current;
      }
    }
    return changes;
  }

  /**
   * Extracts column values from an entity.
   * @param table - The table definition
   * @param entity - The entity instance
   * @returns Object with column values
   */
  private extractColumns(table: TableDef, entity: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const column of Object.keys(table.columns)) {
      if (entity[column] === undefined) continue;
      payload[column] = entity[column];
    }
    return payload;
  }

  /**
   * Executes a compiled query.
   * @param compiled - The compiled query
   * @returns Query results
   */
  private async executeCompiled(compiled: CompiledQuery): Promise<QueryResult[]> {
    const payload = await this.executor.executeSql(compiled.sql, compiled.params);
    return payloadResultSets(payload);
  }

  /**
   * Gets columns for RETURNING clause.
   * @param table - The table definition
   * @returns Array of column nodes
   */
  private getReturningColumns(table: TableDef): ColumnNode[] {
    return Object.values(table.columns).map(column => ({
      type: 'Column',
      table: table.name,
      name: column.name,
      alias: column.name
    }));
  }

  /**
   * Applies RETURNING clause results to the tracked entity.
   * @param tracked - The tracked entity
   * @param results - Query results
   */
  private applyReturningResults(tracked: TrackedEntity, results: QueryResult[]): void {
    const first = results[0];
    if (!first || first.columns.length === 0 || first.values.length === 0) return;

    const row = first.values[0];
    for (let i = 0; i < first.columns.length; i++) {
      const columnName = this.normalizeColumnName(first.columns[i]);
      if (!(columnName in tracked.table.columns)) continue;
      (tracked.entity as Record<string, unknown>)[columnName] = row[i];
    }
  }

  /**
   * Applies the driver-provided insertId when no RETURNING clause was used.
   * Only sets the PK if it is currently absent on the entity.
   * @param tracked - The tracked entity
   * @param results - Query results (may contain meta.insertId)
   */
  private applyInsertedIdIfAbsent(tracked: TrackedEntity, results: QueryResult[]): void {
    const pkName = findPrimaryKey(tracked.table);
    const current = (tracked.entity as Record<string, unknown>)[pkName];
    if (current != null) return;

    const first = results[0];
    const insertId = first?.meta?.insertId;
    if (insertId == null) return;

    (tracked.entity as Record<string, unknown>)[pkName] = insertId;
  }

  /**
   * Normalizes a column name by removing quotes and table prefixes.
   * @param column - The column name to normalize
   * @returns Normalized column name
   */
  private normalizeColumnName(column: string): string {
    const parts = column.split('.');
    const candidate = parts[parts.length - 1];
    return candidate.replace(/^["`[\]]+|["`[\]]+$/g, '');
  }

  /**
   * Registers an entity in the identity map.
   * @param tracked - The tracked entity to register
   */
  private registerIdentity(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    this.identityMap.register(tracked);
  }

  /**
   * Creates a snapshot of an entity's current state.
   * @param table - The table definition
   * @param entity - The entity instance
   * @returns Object with entity state
   */
  private createSnapshot(table: TableDef, entity: Record<string, unknown>): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    for (const column of Object.keys(table.columns)) {
      snapshot[column] = entity[column];
    }
    return snapshot;
  }

  /**
   * Gets the primary key value from a tracked entity.
   * @param tracked - The tracked entity
   * @returns Primary key value or null
   */
  private getPrimaryKeyValue(tracked: TrackedEntity): PrimaryKey | null {
    const key = findPrimaryKey(tracked.table);
    const val = (tracked.entity as Record<string, unknown>)[key];
    if (val === undefined || val === null) return null;
    if (typeof val !== 'string' && typeof val !== 'number') return null;
    return val as PrimaryKey;
  }
}
