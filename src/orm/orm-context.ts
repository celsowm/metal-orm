import type { Dialect } from '../core/dialect/abstract.js';
import type { RelationDef } from '../schema/relation.js';
import type { TableDef } from '../schema/table.js';
import type { DbExecutor, QueryResult } from '../core/execution/db-executor.js';
import { DomainEventBus, DomainEventHandler as DomainEventHandlerFn, addDomainEvent } from './domain-event-bus.js';
import { IdentityMap } from './identity-map.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import { runInTransaction } from './transaction-runner.js';
import { UnitOfWork } from './unit-of-work.js';
import {
  EntityStatus,
  HasDomainEvents,
  RelationChange,
  RelationChangeEntry,
  RelationKey,
  TrackedEntity
} from './runtime-types.js';
import { createQueryLoggingExecutor, QueryLogger } from './query-logger.js';

export interface OrmInterceptor {
  beforeFlush?(ctx: OrmContext): Promise<void> | void;
  afterFlush?(ctx: OrmContext): Promise<void> | void;
}

export type DomainEventHandler = DomainEventHandlerFn<OrmContext>;

export interface OrmContextOptions {
  dialect: Dialect;
  executor: DbExecutor;
  interceptors?: OrmInterceptor[];
  domainEventHandlers?: Record<string, DomainEventHandler[]>;
  queryLogger?: QueryLogger;
}

export class OrmContext {
  private readonly identityMap = new IdentityMap();
  private readonly executorWithLogging: DbExecutor;
  private readonly unitOfWork: UnitOfWork;
  private readonly relationChanges: RelationChangeProcessor;
  private readonly interceptors: OrmInterceptor[];
  private readonly domainEvents: DomainEventBus<OrmContext>;

  constructor(private readonly options: OrmContextOptions) {
    this.interceptors = [...(options.interceptors ?? [])];
    this.executorWithLogging = createQueryLoggingExecutor(options.executor, options.queryLogger);
    this.unitOfWork = new UnitOfWork(
      options.dialect,
      this.executorWithLogging,
      this.identityMap,
      () => this
    );
    this.relationChanges = new RelationChangeProcessor(
      this.unitOfWork,
      options.dialect,
      this.executorWithLogging
    );
    this.domainEvents = new DomainEventBus<OrmContext>(options.domainEventHandlers);
  }

  get dialect(): Dialect {
    return this.options.dialect;
  }

  get executor(): DbExecutor {
    return this.executorWithLogging;
  }

  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.unitOfWork.identityBuckets;
  }

  get tracked(): TrackedEntity[] {
    return this.unitOfWork.getTracked();
  }

  getEntity(table: TableDef, pk: string | number): any | undefined {
    return this.unitOfWork.getEntity(table, pk);
  }

  setEntity(table: TableDef, pk: string | number, entity: any): void {
    this.unitOfWork.setEntity(table, pk, entity);
  }

  trackNew(table: TableDef, entity: any, pk?: string | number): void {
    this.unitOfWork.trackNew(table, entity, pk);
  }

  trackManaged(table: TableDef, pk: string | number, entity: any): void {
    this.unitOfWork.trackManaged(table, pk, entity);
  }

  markDirty(entity: any): void {
    this.unitOfWork.markDirty(entity);
  }

  markRemoved(entity: any): void {
    this.unitOfWork.markRemoved(entity);
  }

  registerRelationChange(
    root: any,
    relationKey: RelationKey,
    rootTable: TableDef,
    relationName: string,
    relation: RelationDef,
    change: RelationChange<any>
  ): void {
    const entry: RelationChangeEntry = {
      root,
      relationKey,
      rootTable,
      relationName,
      relation,
      change
    };
    this.relationChanges.registerChange(entry);
  }

  registerInterceptor(interceptor: OrmInterceptor): void {
    this.interceptors.push(interceptor);
  }

  registerDomainEventHandler(name: string, handler: DomainEventHandler): void {
    this.domainEvents.register(name, handler);
  }

  async saveChanges(): Promise<void> {
    await runInTransaction(this.executor, async () => {
      for (const interceptor of this.interceptors) {
        await interceptor.beforeFlush?.(this);
      }

      await this.unitOfWork.flush();
      await this.relationChanges.process();
      await this.unitOfWork.flush();

      for (const interceptor of this.interceptors) {
        await interceptor.afterFlush?.(this);
      }
    });

    await this.domainEvents.dispatch(this.unitOfWork.getTracked(), this);
  }

  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    return this.unitOfWork.getEntitiesForTable(table);
  }
}

export { addDomainEvent };
export { EntityStatus };
export type {
  QueryResult,
  DbExecutor,
  RelationKey,
  RelationChange,
  HasDomainEvents
};
export type { QueryLogEntry, QueryLogger } from './query-logger.js';
