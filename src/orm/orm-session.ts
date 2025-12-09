import { Dialect } from '../core/dialect/abstract.js';
import { eq } from '../core/ast/expression.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { TableDef } from '../schema/table.js';
import { Entity } from '../schema/types.js';
import { RelationDef } from '../schema/relation.js';

import { selectFromEntity, getTableDefFromEntity } from '../decorators/bootstrap.js';
import type { EntityConstructor } from './entity-metadata.js';
import { Orm } from './orm.js';
import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import { DomainEventBus, DomainEventHandler } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import { createQueryLoggingExecutor, QueryLogger } from './query-logger.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';
import { EntityContext } from './entity-context.js';
import {
  RelationChange,
  RelationChangeEntry,
  RelationKey,
  TrackedEntity
} from './runtime-types.js';
import { executeHydrated } from './execute.js';
import { runInTransaction } from './transaction-runner.js';

export interface OrmInterceptor {
  beforeFlush?(ctx: EntityContext): Promise<void> | void;
  afterFlush?(ctx: EntityContext): Promise<void> | void;
}

export interface OrmSessionOptions {
  orm: Orm;
  executor: DbExecutor;
  queryLogger?: QueryLogger;
  interceptors?: OrmInterceptor[];
  domainEventHandlers?: Record<string, DomainEventHandler<OrmSession>[]>;
}

export class OrmSession implements EntityContext {
  readonly orm: Orm;
  readonly executor: DbExecutor;
  readonly identityMap: IdentityMap;
  readonly unitOfWork: UnitOfWork;
  readonly domainEvents: DomainEventBus<OrmSession>;
  readonly relationChanges: RelationChangeProcessor;

  private readonly interceptors: OrmInterceptor[];

  constructor(opts: OrmSessionOptions) {
    this.orm = opts.orm;
    this.executor = createQueryLoggingExecutor(opts.executor, opts.queryLogger);
    this.interceptors = [...(opts.interceptors ?? [])];

    this.identityMap = new IdentityMap();
    this.unitOfWork = new UnitOfWork(this.orm.dialect, this.executor, this.identityMap, () => this);
    this.relationChanges = new RelationChangeProcessor(this.unitOfWork, this.orm.dialect, this.executor);
    this.domainEvents = new DomainEventBus<OrmSession>(opts.domainEventHandlers);
  }

  get dialect(): Dialect {
    return this.orm.dialect;
  }

  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.unitOfWork.identityBuckets;
  }

  get tracked(): TrackedEntity[] {
    return this.unitOfWork.getTracked();
  }

  getEntity(table: TableDef, pk: any): any | undefined {
    return this.unitOfWork.getEntity(table, pk);
  }

  setEntity(table: TableDef, pk: any, entity: any): void {
    this.unitOfWork.setEntity(table, pk, entity);
  }

  trackNew(table: TableDef, entity: any, pk?: any): void {
    this.unitOfWork.trackNew(table, entity, pk);
  }

  trackManaged(table: TableDef, pk: any, entity: any): void {
    this.unitOfWork.trackManaged(table, pk, entity);
  }

  markDirty(entity: any): void {
    this.unitOfWork.markDirty(entity);
  }

  markRemoved(entity: any): void {
    this.unitOfWork.markRemoved(entity);
  }

  registerRelationChange = (
    root: any,
    relationKey: RelationKey,
    rootTable: TableDef,
    relationName: string,
    relation: RelationDef,
    change: RelationChange<any>
  ): void => {
    this.relationChanges.registerChange(
      buildRelationChangeEntry(root, relationKey, rootTable, relationName, relation, change)
    );
  };

  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    return this.unitOfWork.getEntitiesForTable(table);
  }

  registerInterceptor(interceptor: OrmInterceptor): void {
    this.interceptors.push(interceptor);
  }

  registerDomainEventHandler(name: string, handler: DomainEventHandler<OrmSession>): void {
    this.domainEvents.register(name, handler);
  }

  async find<TTable extends TableDef>(entityClass: EntityConstructor, id: any): Promise<Entity<TTable> | null> {
    const table = getTableDefFromEntity(entityClass);
    if (!table) {
      throw new Error('Entity metadata has not been bootstrapped');
    }
    const primaryKey = findPrimaryKey(table);
    const column = table.columns[primaryKey];
    if (!column) {
      throw new Error('Entity table does not expose a primary key');
    }
    const qb = selectFromEntity<TTable>(entityClass)
      .where(eq(column, id))
      .limit(1);
    const rows = await executeHydrated(this, qb);
    return rows[0] ?? null;
  }

  async findOne<TTable extends TableDef>(qb: SelectQueryBuilder<any, TTable>): Promise<Entity<TTable> | null> {
    const limited = qb.limit(1);
    const rows = await executeHydrated(this, limited);
    return rows[0] ?? null;
  }

  async findMany<TTable extends TableDef>(qb: SelectQueryBuilder<any, TTable>): Promise<Entity<TTable>[]> {
    return executeHydrated(this, qb);
  }

  async persist(entity: object): Promise<void> {
    if (this.unitOfWork.findTracked(entity)) {
      return;
    }
    const table = getTableDefFromEntity((entity as any).constructor as EntityConstructor);
    if (!table) {
      throw new Error('Entity metadata has not been bootstrapped');
    }
    const primaryKey = findPrimaryKey(table);
    const pkValue = (entity as Record<string, any>)[primaryKey];
    if (pkValue !== undefined && pkValue !== null) {
      this.trackManaged(table, pkValue, entity);
    } else {
      this.trackNew(table, entity);
    }
  }

  async remove(entity: object): Promise<void> {
    this.markRemoved(entity);
  }

  async flush(): Promise<void> {
    await this.unitOfWork.flush();
  }

  async commit(): Promise<void> {
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

  async rollback(): Promise<void> {
    await this.executor.rollbackTransaction?.();
    this.unitOfWork.reset();
    this.relationChanges.reset();
  }

  getExecutionContext(): ExecutionContext {
    return {
      dialect: this.orm.dialect,
      executor: this.executor,
      interceptors: this.orm.interceptors
    };
  }

  getHydrationContext(): HydrationContext {
    return {
      identityMap: this.identityMap,
      unitOfWork: this.unitOfWork,
      domainEvents: this.domainEvents,
      relationChanges: this.relationChanges,
      entityContext: this
    };
  }
}

const buildRelationChangeEntry = (
  root: any,
  relationKey: RelationKey,
  rootTable: TableDef,
  relationName: string,
  relation: RelationDef,
  change: RelationChange<any>
): RelationChangeEntry => ({
  root,
  relationKey,
  rootTable,
  relationName,
  relation,
  change
});
