import { Dialect, CompiledQuery } from '../dialect/abstract';
import { findPrimaryKey } from '../builder/hydration-planner';
import { TableDef, TableHooks } from '../schema/table';
import {
  RelationDef,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  RelationKinds
} from '../schema/relation';
import { InsertQueryBuilder } from '../builder/insert';
import { UpdateQueryBuilder } from '../builder/update';
import { DeleteQueryBuilder } from '../builder/delete';
import { and, eq } from '../ast/expression';

export type QueryResult = {
  columns: string[];
  values: unknown[][];
};

export interface DbExecutor {
  executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
}

export interface OrmInterceptor {
  beforeFlush?(ctx: OrmContext): Promise<void> | void;
  afterFlush?(ctx: OrmContext): Promise<void> | void;
}

export interface DomainEventHandler {
  (event: any, ctx: OrmContext): Promise<void> | void;
}

export interface HasDomainEvents {
  domainEvents?: any[];
}

export type RelationKey = string;

export type RelationChange<T> =
  | { kind: 'add'; entity: T }
  | { kind: 'attach'; entity: T }
  | { kind: 'remove'; entity: T }
  | { kind: 'detach'; entity: T };

export interface RelationChangeEntry {
  root: any;
  relationKey: RelationKey;
  rootTable: TableDef;
  relationName: string;
  relation: RelationDef;
  change: RelationChange<any>;
}

export enum EntityStatus {
  New = 'new',
  Managed = 'managed',
  Dirty = 'dirty',
  Removed = 'removed',
  Detached = 'detached'
}

interface TrackedEntity {
  table: TableDef;
  entity: any;
  pk: string | number | null;
  status: EntityStatus;
  original: Record<string, any> | null;
}

export interface OrmContextOptions {
  dialect: Dialect;
  executor: DbExecutor;
  interceptors?: OrmInterceptor[];
  domainEventHandlers?: Record<string, DomainEventHandler[]>;
}

export class OrmContext {
  private readonly identityMap = new Map<string, Map<string, TrackedEntity>>();
  private readonly trackedEntities = new Map<any, TrackedEntity>();
  private readonly relationChanges: RelationChangeEntry[] = [];
  private readonly interceptors: OrmInterceptor[];
  private readonly domainEventHandlers = new Map<string, DomainEventHandler[]>();

  constructor(private readonly options: OrmContextOptions) {
    this.interceptors = [...(options.interceptors ?? [])];
    const handlers = options.domainEventHandlers ?? {};
    Object.entries(handlers).forEach(([name, list]) => {
      this.domainEventHandlers.set(name, [...list]);
    });
  }

  get dialect(): Dialect {
    return this.options.dialect;
  }

  get executor(): DbExecutor {
    return this.options.executor;
  }

  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.identityMap;
  }

  get tracked(): TrackedEntity[] {
    return Array.from(this.trackedEntities.values());
  }

  getEntity(table: TableDef, pk: string | number): any | undefined {
    const bucket = this.identityMap.get(table.name);
    return bucket?.get(this.toIdentityKey(pk))?.entity;
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

  registerRelationChange(
    root: any,
    relationKey: RelationKey,
    rootTable: TableDef,
    relationName: string,
    relation: RelationDef,
    change: RelationChange<any>
  ): void {
    this.relationChanges.push({
      root,
      relationKey,
      rootTable,
      relationName,
      relation,
      change
    });
  }

  registerInterceptor(interceptor: OrmInterceptor): void {
    this.interceptors.push(interceptor);
  }

  registerDomainEventHandler(name: string, handler: DomainEventHandler): void {
    const existing = this.domainEventHandlers.get(name) ?? [];
    existing.push(handler);
    this.domainEventHandlers.set(name, existing);
  }

  async saveChanges(): Promise<void> {
    await this.runInTransaction(async () => {
      for (const interceptor of this.interceptors) {
        await interceptor.beforeFlush?.(this);
      }

      await this.flushEntities();
      await this.processRelationChanges();
      await this.flushEntities();

      for (const interceptor of this.interceptors) {
        await interceptor.afterFlush?.(this);
      }
    });

    await this.dispatchDomainEvents();
  }

  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    const bucket = this.identityMap.get(table.name);
    return bucket ? Array.from(bucket.values()) : [];
  }

  protected async flushEntities(): Promise<void> {
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
    const builder = new InsertQueryBuilder(tracked.table).values(payload);
    const compiled = builder.compile(this.dialect);
    await this.executeCompiled(compiled);

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

    const builder = new UpdateQueryBuilder(tracked.table)
      .set(changes)
      .where(eq(pkColumn, tracked.pk));

    const compiled = builder.compile(this.dialect);
    await this.executeCompiled(compiled);

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

    const builder = new DeleteQueryBuilder(tracked.table).where(
      eq(pkColumn, tracked.pk)
    );
    const compiled = builder.compile(this.dialect);
    await this.executeCompiled(compiled);

    tracked.status = EntityStatus.Detached;
    this.trackedEntities.delete(tracked.entity);
    this.removeIdentity(tracked);

    await this.runHook(tracked.table.hooks?.afterDelete, tracked);
  }

  private async processRelationChanges(): Promise<void> {
    if (!this.relationChanges.length) return;
    const entries = [...this.relationChanges];
    this.relationChanges.length = 0;

    for (const entry of entries) {
      switch (entry.relation.type) {
        case RelationKinds.HasMany:
          await this.handleHasManyChange(entry);
          break;
        case RelationKinds.BelongsToMany:
          await this.handleBelongsToManyChange(entry);
          break;
        case RelationKinds.BelongsTo:
          await this.handleBelongsToChange(entry);
          break;
      }
    }
  }

  private async handleHasManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as HasManyRelation;
    const target = entry.change.entity;
    if (!target) return;

    const tracked = this.trackedEntities.get(target);
    if (!tracked) return;

    const localKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootValue = entry.root[localKey];
    if (rootValue === undefined || rootValue === null) return;

    if (entry.change.kind === 'add' || entry.change.kind === 'attach') {
      this.assignHasManyForeignKey(tracked, relation, rootValue);
      return;
    }

    if (entry.change.kind === 'remove') {
      this.detachHasManyChild(tracked, relation);
    }
  }

  private async handleBelongsToChange(_entry: RelationChangeEntry): Promise<void> {
    // Reserved for future cascade/persist behaviors for belongs-to relations.
  }

  private async handleBelongsToManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as BelongsToManyRelation;
    const rootKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootId = entry.root[rootKey];
    if (rootId === undefined || rootId === null) return;

    const targetId = this.resolvePrimaryKeyValue(entry.change.entity, relation.target);
    if (targetId === null) return;

    if (entry.change.kind === 'attach' || entry.change.kind === 'add') {
      await this.insertPivotRow(relation, rootId, targetId);
      return;
    }

    if (entry.change.kind === 'detach' || entry.change.kind === 'remove') {
      await this.deletePivotRow(relation, rootId, targetId);

      if (relation.cascade === 'all' || relation.cascade === 'remove') {
        this.markRemoved(entry.change.entity);
      }
    }
  }

  private assignHasManyForeignKey(
    tracked: TrackedEntity,
    relation: HasManyRelation,
    rootValue: unknown
  ): void {
    const child = tracked.entity;
    const current = child[relation.foreignKey];
    if (current === rootValue) return;
    child[relation.foreignKey] = rootValue;
    this.markDirty(child);
  }

  private detachHasManyChild(tracked: TrackedEntity, relation: HasManyRelation): void {
    const child = tracked.entity;
    if (relation.cascade === 'all' || relation.cascade === 'remove') {
      this.markRemoved(child);
      return;
    }
    child[relation.foreignKey] = null;
    this.markDirty(child);
  }

  private async insertPivotRow(relation: BelongsToManyRelation, rootId: string | number, targetId: string | number): Promise<void> {
    const payload = {
      [relation.pivotForeignKeyToRoot]: rootId,
      [relation.pivotForeignKeyToTarget]: targetId
    };
    const builder = new InsertQueryBuilder(relation.pivotTable).values(payload);
    await this.executeCompiled(builder.compile(this.dialect));
  }

  private async deletePivotRow(relation: BelongsToManyRelation, rootId: string | number, targetId: string | number): Promise<void> {
    const rootCol = relation.pivotTable.columns[relation.pivotForeignKeyToRoot];
    const targetCol = relation.pivotTable.columns[relation.pivotForeignKeyToTarget];
    if (!rootCol || !targetCol) return;

    const builder = new DeleteQueryBuilder(relation.pivotTable).where(
      and(eq(rootCol, rootId), eq(targetCol, targetId))
    );
    await this.executeCompiled(builder.compile(this.dialect));
  }

  private resolvePrimaryKeyValue(entity: any, table: TableDef): string | number | null {
    if (!entity) return null;
    const key = findPrimaryKey(table);
    const value = entity[key];
    if (value === undefined || value === null) return null;
    return value;
  }

  private async dispatchDomainEvents(): Promise<void> {
    for (const tracked of this.trackedEntities.values()) {
      const entity = tracked.entity as HasDomainEvents;
      if (!entity.domainEvents || !entity.domainEvents.length) continue;

      for (const event of entity.domainEvents) {
        const eventName = this.getEventName(event);
        const handlers = this.domainEventHandlers.get(eventName);
        if (!handlers) continue;

        for (const handler of handlers) {
          await handler(event, this);
        }
      }

      entity.domainEvents = [];
    }
  }

  private async runHook(
    hook: TableHooks[keyof TableHooks] | undefined,
    tracked: TrackedEntity
  ): Promise<void> {
    if (!hook) return;
    await hook(this, tracked.entity);
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

  private async executeCompiled(compiled: CompiledQuery): Promise<void> {
    await this.executor.executeSql(compiled.sql, compiled.params);
  }

  private registerIdentity(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    const bucket = this.identityMap.get(tracked.table.name) ?? new Map<string, TrackedEntity>();
    bucket.set(this.toIdentityKey(tracked.pk), tracked);
    this.identityMap.set(tracked.table.name, bucket);
  }

  private removeIdentity(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    const bucket = this.identityMap.get(tracked.table.name);
    bucket?.delete(this.toIdentityKey(tracked.pk));
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

  private async runInTransaction(action: () => Promise<void>): Promise<void> {
    const executor = this.executor;
    if (!executor.beginTransaction) {
      await action();
      return;
    }

    await executor.beginTransaction();
    try {
      await action();
      await executor.commitTransaction?.();
    } catch (error) {
      await executor.rollbackTransaction?.();
      throw error;
    }
  }

  private toIdentityKey(pk: string | number): string {
    return String(pk);
  }

  private getEventName(event: any): string {
    if (!event) return 'Unknown';
    if (typeof event === 'string') return event;
    return event.constructor?.name ?? 'Unknown';
  }
}

export const addDomainEvent = (entity: HasDomainEvents, event: any): void => {
  if (!entity.domainEvents) {
    entity.domainEvents = [];
  }
  entity.domainEvents.push(event);
};
