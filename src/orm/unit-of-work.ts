import { ColumnNode, eq } from '../core/ast/expression.js';
import type { Dialect, CompiledQuery } from '../core/dialect/abstract.js';
import { InsertQueryBuilder } from '../query-builder/insert.js';
import { UpdateQueryBuilder } from '../query-builder/update.js';
import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { TableDef, TableHooks } from '../schema/table.js';
import type { DbExecutor, QueryResult } from './db-executor.js';
import { IdentityMap } from './identity-map.js';
import { EntityStatus } from './runtime-types.js';
import type { TrackedEntity } from './runtime-types.js';

export class UnitOfWork {
  private readonly trackedEntities = new Map<any, TrackedEntity>();

  constructor(
    private readonly dialect: Dialect,
    private readonly executor: DbExecutor,
    private readonly identityMap: IdentityMap,
    private readonly hookContext: () => unknown
  ) {}

  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.identityMap.bucketsMap;
  }

  getTracked(): TrackedEntity[] {
    return Array.from(this.trackedEntities.values());
  }

  getEntity(table: TableDef, pk: string | number): any | undefined {
    return this.identityMap.getEntity(table, pk);
  }

  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    return this.identityMap.getEntitiesForTable(table);
  }

  findTracked(entity: any): TrackedEntity | undefined {
    return this.trackedEntities.get(entity);
  }

  setEntity(table: TableDef, pk: string | number, entity: any): void {
    if (pk === null || pk === undefined) return;
    let tracked = this.trackedEntities.get(entity);
    if (!tracked) {
      tracked = {
        table,
        entity,
        pk,
        status: EntityStatus.Managed,
        original: this.createSnapshot(table, entity)
      };
      this.trackedEntities.set(entity, tracked);
    } else {
      tracked.pk = pk;
    }

    this.registerIdentity(tracked);
  }

  trackNew(table: TableDef, entity: any, pk?: string | number): void {
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

  trackManaged(table: TableDef, pk: string | number, entity: any): void {
    const tracked: TrackedEntity = {
      table,
      entity,
      pk,
      status: EntityStatus.Managed,
      original: this.createSnapshot(table, entity)
    };
    this.trackedEntities.set(entity, tracked);
    this.registerIdentity(tracked);
  }

  markDirty(entity: any): void {
    const tracked = this.trackedEntities.get(entity);
    if (!tracked) return;
    if (tracked.status === EntityStatus.New || tracked.status === EntityStatus.Removed) return;
    tracked.status = EntityStatus.Dirty;
  }

  markRemoved(entity: any): void {
    const tracked = this.trackedEntities.get(entity);
    if (!tracked) return;
    tracked.status = EntityStatus.Removed;
  }

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

  private async flushInsert(tracked: TrackedEntity): Promise<void> {
    await this.runHook(tracked.table.hooks?.beforeInsert, tracked);

    const payload = this.extractColumns(tracked.table, tracked.entity);
    let builder = new InsertQueryBuilder(tracked.table).values(payload);
    if (this.dialect.supportsReturning()) {
      builder = builder.returning(...this.getReturningColumns(tracked.table));
    }
    const compiled = builder.compile(this.dialect);
    const results = await this.executeCompiled(compiled);
    this.applyReturningResults(tracked, results);

    tracked.status = EntityStatus.Managed;
    tracked.original = this.createSnapshot(tracked.table, tracked.entity);
    tracked.pk = this.getPrimaryKeyValue(tracked);
    this.registerIdentity(tracked);

    await this.runHook(tracked.table.hooks?.afterInsert, tracked);
  }

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

    if (this.dialect.supportsReturning()) {
      builder = builder.returning(...this.getReturningColumns(tracked.table));
    }

    const compiled = builder.compile(this.dialect);
    const results = await this.executeCompiled(compiled);
    this.applyReturningResults(tracked, results);

    tracked.status = EntityStatus.Managed;
    tracked.original = this.createSnapshot(tracked.table, tracked.entity);
    this.registerIdentity(tracked);

    await this.runHook(tracked.table.hooks?.afterUpdate, tracked);
  }

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

  private async runHook(
    hook: TableHooks[keyof TableHooks] | undefined,
    tracked: TrackedEntity
  ): Promise<void> {
    if (!hook) return;
    await hook(this.hookContext() as any, tracked.entity);
  }

  private computeChanges(tracked: TrackedEntity): Record<string, unknown> {
    const snapshot = tracked.original ?? {};
    const changes: Record<string, unknown> = {};
    for (const column of Object.keys(tracked.table.columns)) {
      const current = tracked.entity[column];
      if (snapshot[column] !== current) {
        changes[column] = current;
      }
    }
    return changes;
  }

  private extractColumns(table: TableDef, entity: any): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const column of Object.keys(table.columns)) {
      payload[column] = entity[column];
    }
    return payload;
  }

  private async executeCompiled(compiled: CompiledQuery): Promise<QueryResult[]> {
    return this.executor.executeSql(compiled.sql, compiled.params);
  }

  private getReturningColumns(table: TableDef): ColumnNode[] {
    return Object.values(table.columns).map(column => ({
      type: 'Column',
      table: table.name,
      name: column.name,
      alias: column.name
    }));
  }

  private applyReturningResults(tracked: TrackedEntity, results: QueryResult[]): void {
    if (!this.dialect.supportsReturning()) return;
    const first = results[0];
    if (!first || first.values.length === 0) return;

    const row = first.values[0];
    for (let i = 0; i < first.columns.length; i++) {
      const columnName = this.normalizeColumnName(first.columns[i]);
      if (!(columnName in tracked.table.columns)) continue;
      tracked.entity[columnName] = row[i];
    }
  }

  private normalizeColumnName(column: string): string {
    const parts = column.split('.');
    const candidate = parts[parts.length - 1];
    return candidate.replace(/^["`[\]]+|["`[\]]+$/g, '');
  }

  private registerIdentity(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    this.identityMap.register(tracked);
  }

  private createSnapshot(table: TableDef, entity: any): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const column of Object.keys(table.columns)) {
      snapshot[column] = entity[column];
    }
    return snapshot;
  }

  private getPrimaryKeyValue(tracked: TrackedEntity): string | number | null {
    const key = findPrimaryKey(tracked.table);
    const val = tracked.entity[key];
    if (val === undefined || val === null) return null;
    return val;
  }
}
