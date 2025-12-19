import { Dialect } from '../core/dialect/abstract.js';
import { eq } from '../core/ast/expression.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { ColumnDef } from '../schema/column-types.js';
import type { TableDef } from '../schema/table.js';
import { EntityInstance } from '../schema/types.js';
import { RelationDef } from '../schema/relation.js';

import { selectFromEntity, getTableDefFromEntity } from '../decorators/bootstrap.js';
import type { EntityConstructor } from './entity-metadata.js';
import { Orm } from './orm.js';
import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import { DomainEventBus, DomainEventHandler, InitialHandlers } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import { createQueryLoggingExecutor, QueryLogger } from './query-logger.js';
import { ExecutionContext } from './execution-context.js';
import type { HydrationContext } from './hydration-context.js';
import type { EntityContext } from './entity-context.js';
import {
  DomainEvent,
  OrmDomainEvent,
  RelationChange,
  RelationChangeEntry,
  RelationKey,
  TrackedEntity
} from './runtime-types.js';
import { executeHydrated } from './execute.js';
import { runInTransaction } from './transaction-runner.js';
import { saveGraphInternal, SaveGraphOptions } from './save-graph.js';
import type { SaveGraphInputPayload } from './save-graph-types.js';

/**
 * Interface for ORM interceptors that allow hooking into the flush lifecycle.
 */
export interface OrmInterceptor {
  /**
   * Called before the flush operation begins.
   * @param ctx - The entity context
   */
  beforeFlush?(ctx: EntityContext): Promise<void> | void;

  /**
   * Called after the flush operation completes.
   * @param ctx - The entity context
   */
  afterFlush?(ctx: EntityContext): Promise<void> | void;
}

/**
 * Options for creating an OrmSession instance.
 * @template E - The domain event type
 */
export interface OrmSessionOptions<E extends DomainEvent = OrmDomainEvent> {
  /** The ORM instance */
  orm: Orm<E>;
  /** The database executor */
  executor: DbExecutor;
  /** Optional query logger for debugging */
  queryLogger?: QueryLogger;
  /** Optional interceptors for flush lifecycle hooks */
  interceptors?: OrmInterceptor[];
  /** Optional domain event handlers */
  domainEventHandlers?: InitialHandlers<E, OrmSession<E>>;
}

/**
 * ORM Session that manages entity lifecycle, identity mapping, and database operations.
 * @template E - The domain event type
 */
export class OrmSession<E extends DomainEvent = OrmDomainEvent> implements EntityContext {
  /** The ORM instance */
  readonly orm: Orm<E>;
  /** The database executor */
  readonly executor: DbExecutor;
  /** The identity map for tracking entity instances */
  readonly identityMap: IdentityMap;
  /** The unit of work for tracking entity changes */
  readonly unitOfWork: UnitOfWork;
  /** The domain event bus */
  readonly domainEvents: DomainEventBus<E, OrmSession<E>>;
  /** The relation change processor */
  readonly relationChanges: RelationChangeProcessor;

  private readonly interceptors: OrmInterceptor[];

  /**
   * Creates a new OrmSession instance.
   * @param opts - Session options
   */
  constructor(opts: OrmSessionOptions<E>) {
    this.orm = opts.orm;
    this.executor = createQueryLoggingExecutor(opts.executor, opts.queryLogger);
    this.interceptors = [...(opts.interceptors ?? [])];

    this.identityMap = new IdentityMap();
    this.unitOfWork = new UnitOfWork(this.orm.dialect, this.executor, this.identityMap, () => this);
    this.relationChanges = new RelationChangeProcessor(this.unitOfWork, this.orm.dialect, this.executor);
    this.domainEvents = new DomainEventBus<E, OrmSession<E>>(opts.domainEventHandlers);
  }

  /**
   * Releases resources associated with this session (executor/pool leases) and resets tracking.
   * Must be safe to call multiple times.
   */
  async dispose(): Promise<void> {
    try {
      await this.executor.dispose();
    } finally {
      // Always reset in-memory tracking.
      this.unitOfWork.reset();
      this.relationChanges.reset();
    }
  }

  /**
   * Gets the database dialect.
   */
  get dialect(): Dialect {
    return this.orm.dialect;
  }

  /**
   * Gets the identity buckets map.
   */
  get identityBuckets(): Map<string, Map<string, TrackedEntity>> {
    return this.unitOfWork.identityBuckets;
  }

  /**
   * Gets all tracked entities.
   */
  get tracked(): TrackedEntity[] {
    return this.unitOfWork.getTracked();
  }

  /**
   * Gets an entity by table and primary key.
   * @param table - The table definition
   * @param pk - The primary key value
   * @returns The entity or undefined if not found
   */
  getEntity(table: TableDef, pk: unknown): unknown | undefined {
    return this.unitOfWork.getEntity(table, pk as string | number);
  }

  /**
   * Sets an entity in the identity map.
   * @param table - The table definition
   * @param pk - The primary key value
   * @param entity - The entity instance
   */
  setEntity(table: TableDef, pk: unknown, entity: unknown): void {
    this.unitOfWork.setEntity(table, pk as string | number, entity);
  }

  /**
   * Tracks a new entity.
   * @param table - The table definition
   * @param entity - The entity instance
   * @param pk - Optional primary key value
   */
  trackNew(table: TableDef, entity: unknown, pk?: unknown): void {
    this.unitOfWork.trackNew(table, entity, pk as string | number);
  }

  /**
   * Tracks a managed entity.
   * @param table - The table definition
   * @param pk - The primary key value
   * @param entity - The entity instance
   */
  trackManaged(table: TableDef, pk: unknown, entity: unknown): void {
    this.unitOfWork.trackManaged(table, pk as string | number, entity);
  }

  /**
   * Marks an entity as dirty (modified).
   * @param entity - The entity to mark as dirty
   */
  markDirty(entity: unknown): void {
    this.unitOfWork.markDirty(entity);
  }

  /**
   * Marks an entity as removed.
   * @param entity - The entity to mark as removed
   */
  markRemoved(entity: unknown): void {
    this.unitOfWork.markRemoved(entity);
  }

  /**
   * Registers a relation change.
   * @param root - The root entity
   * @param relationKey - The relation key
   * @param rootTable - The root table definition
   * @param relationName - The relation name
   * @param relation - The relation definition
   * @param change - The relation change
   */
  registerRelationChange = (
    root: unknown,
    relationKey: RelationKey,
    rootTable: TableDef,
    relationName: string,
    relation: RelationDef,
    change: RelationChange<unknown>
  ): void => {
    this.relationChanges.registerChange(
      buildRelationChangeEntry(root, relationKey, rootTable, relationName, relation, change)
    );
  };

  /**
   * Gets all tracked entities for a specific table.
   * @param table - The table definition
   * @returns Array of tracked entities
   */
  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    return this.unitOfWork.getEntitiesForTable(table);
  }

  /**
   * Registers an interceptor for flush lifecycle hooks.
   * @param interceptor - The interceptor to register
   */
  registerInterceptor(interceptor: OrmInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Registers a domain event handler.
   * @param type - The event type
   * @param handler - The event handler
   */
  registerDomainEventHandler<TType extends E['type']>(
    type: TType,
    handler: DomainEventHandler<Extract<E, { type: TType }>, OrmSession<E>>
  ): void {
    this.domainEvents.on(type, handler);
  }

  /**
   * Finds an entity by its primary key.
   * @template TCtor - The entity constructor type
   * @param entityClass - The entity constructor
   * @param id - The primary key value
   * @returns The entity instance or null if not found
   * @throws If entity metadata is not bootstrapped or table has no primary key
   */
  async find<TCtor extends EntityConstructor<object>>(
    entityClass: TCtor,
    id: unknown
  ): Promise<InstanceType<TCtor> | null> {
    const table = getTableDefFromEntity(entityClass);
    if (!table) {
      throw new Error('Entity metadata has not been bootstrapped');
    }
    const primaryKey = findPrimaryKey(table);
    const column = table.columns[primaryKey];
    if (!column) {
      throw new Error('Entity table does not expose a primary key');
    }
    const columnSelections = Object.values(table.columns).reduce<Record<string, ColumnDef>>((acc, col) => {
      acc[col.name] = col;
      return acc;
    }, {});
    const qb = selectFromEntity(entityClass)
      .select(columnSelections)
      .where(eq(column, id as string | number))
      .limit(1);
    const rows = await executeHydrated(this, qb);
    return (rows[0] ?? null) as InstanceType<TCtor> | null;
  }

  /**
   * Finds a single entity using a query builder.
   * @template TTable - The table type
   * @param qb - The query builder
   * @returns The first entity instance or null if not found
   */
  async findOne<TTable extends TableDef>(qb: SelectQueryBuilder<unknown, TTable>): Promise<EntityInstance<TTable> | null> {
    const limited = qb.limit(1);
    const rows = await executeHydrated(this, limited);
    return rows[0] ?? null;
  }

  /**
   * Finds multiple entities using a query builder.
   * @template TTable - The table type
   * @param qb - The query builder
   * @returns Array of entity instances
   */
  async findMany<TTable extends TableDef>(qb: SelectQueryBuilder<unknown, TTable>): Promise<EntityInstance<TTable>[]> {
    return executeHydrated(this, qb);
  }

  /**
   * Saves an entity graph (root + nested relations) based on a DTO-like payload.
   * @param entityClass - Root entity constructor
   * @param payload - DTO payload containing column values and nested relations
   * @param options - Graph save options
   * @returns The root entity instance
   */
  async saveGraph<TCtor extends EntityConstructor<object>>(
    entityClass: TCtor,
    payload: SaveGraphInputPayload<InstanceType<TCtor>>,
    options?: SaveGraphOptions & { transactional?: boolean }
  ): Promise<InstanceType<TCtor>>;
  async saveGraph<TCtor extends EntityConstructor<object>>(
    entityClass: TCtor,
    payload: Record<string, unknown>,
    options?: SaveGraphOptions & { transactional?: boolean }
  ): Promise<InstanceType<TCtor>> {
    const { transactional = true, ...graphOptions } = options ?? {};
    const execute = () => saveGraphInternal(this, entityClass, payload, graphOptions);
    if (!transactional) {
      return execute();
    }
    return this.transaction(() => execute());
  }

  /**
   * Persists an entity (either inserts or updates).
   * @param entity - The entity to persist
   * @throws If entity metadata is not bootstrapped
   */
  async persist(entity: object): Promise<void> {
    if (this.unitOfWork.findTracked(entity)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = getTableDefFromEntity((entity as { constructor: EntityConstructor }).constructor);
    if (!table) {
      throw new Error('Entity metadata has not been bootstrapped');
    }
    const primaryKey = findPrimaryKey(table);
    const pkValue = (entity as Record<string, unknown>)[primaryKey];
    if (pkValue !== undefined && pkValue !== null) {
      this.trackManaged(table, pkValue, entity);
    } else {
      this.trackNew(table, entity);
    }
  }

  /**
   * Marks an entity for removal.
   * @param entity - The entity to remove
   */
  async remove(entity: object): Promise<void> {
    this.markRemoved(entity);
  }

  /**
   * Flushes pending changes to the database without session hooks, relation processing, or domain events.
   */
  async flush(): Promise<void> {
    await this.unitOfWork.flush();
  }

  /**
   * Flushes pending changes with interceptors and relation processing.
   */
  private async flushWithHooks(): Promise<void> {
    for (const interceptor of this.interceptors) {
      await interceptor.beforeFlush?.(this);
    }

    await this.unitOfWork.flush();
    await this.relationChanges.process();
    await this.unitOfWork.flush();

    for (const interceptor of this.interceptors) {
      await interceptor.afterFlush?.(this);
    }
  }

  /**
   * Commits the current transaction.
   */
  async commit(): Promise<void> {
    await runInTransaction(this.executor, async () => {
      await this.flushWithHooks();
    });

    await this.domainEvents.dispatch(this.unitOfWork.getTracked(), this);
  }

  /**
   * Executes a function within a transaction.
   * @template T - The return type
   * @param fn - The function to execute
   * @returns The result of the function
   * @throws If the transaction fails
   */
  async transaction<T>(fn: (session: OrmSession<E>) => Promise<T>): Promise<T> {
    // If the executor can't do transactions, just run and commit once.
    if (!this.executor.capabilities.transactions) {
      const result = await fn(this);
      await this.commit();
      return result;
    }

    await this.executor.beginTransaction();
    try {
      const result = await fn(this);
      await this.flushWithHooks();
      await this.executor.commitTransaction();
      await this.domainEvents.dispatch(this.unitOfWork.getTracked(), this);
      return result;
    } catch (err) {
      await this.rollback();
      throw err;
    }
  }

  /**
   * Rolls back the current transaction.
   */
  async rollback(): Promise<void> {
    if (this.executor.capabilities.transactions) {
      await this.executor.rollbackTransaction();
    }
    this.unitOfWork.reset();
    this.relationChanges.reset();
  }

  /**
   * Gets the execution context.
   * @returns The execution context
   */
  getExecutionContext(): ExecutionContext {
    return {
      dialect: this.orm.dialect,
      executor: this.executor,
      interceptors: this.orm.interceptors
    };
  }

  /**
   * Gets the hydration context.
   * @returns The hydration context
   */
  getHydrationContext(): HydrationContext<E> {
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
  root: unknown,
  relationKey: RelationKey,
  rootTable: TableDef,
  relationName: string,
  relation: RelationDef,
  change: RelationChange<unknown>
): RelationChangeEntry => ({
  root,
  relationKey,
  rootTable,
  relationName,
  relation,
  change
});

