import type { DbExecutor } from '../core/execution/db-executor.js';
import { Orm } from './orm.js';
import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import { DomainEventBus } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import { createQueryLoggingExecutor, QueryLogger } from './query-logger.js';
import { OrmInterceptor } from './orm-context.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';

export interface OrmSessionOptions {
  orm: Orm;
  executor: DbExecutor;
  queryLogger?: QueryLogger;
  interceptors?: OrmInterceptor[];
}

export class OrmSession {
  readonly orm: Orm;
  readonly executor: DbExecutor;
  readonly identityMap: IdentityMap;
  readonly unitOfWork: UnitOfWork;
  readonly domainEvents: DomainEventBus<OrmSession>;
  readonly relationChanges: RelationChangeProcessor;

  private readonly interceptors: OrmInterceptor[];
  private readonly executorWithLogging: DbExecutor;

  constructor(opts: OrmSessionOptions) {
    this.orm = opts.orm;
    this.executor = opts.executor;
    this.interceptors = [...(opts.interceptors ?? [])];

    this.executorWithLogging = createQueryLoggingExecutor(opts.executor, opts.queryLogger);
    this.identityMap = new IdentityMap();
    this.unitOfWork = new UnitOfWork(
      opts.orm.dialect,
      this.executorWithLogging,
      this.identityMap,
      () => this
    );
    this.relationChanges = new RelationChangeProcessor(
      this.unitOfWork,
      opts.orm.dialect,
      this.executorWithLogging
    );
    this.domainEvents = new DomainEventBus<OrmSession>({});
  }

  // public API
  async find<T>(entityClass: any, id: any): Promise<T | null> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  async findOne<T>(qb: any): Promise<T | null> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  async findMany<T>(qb: any): Promise<T[]> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  async persist(entity: object): Promise<void> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  async remove(entity: object): Promise<void> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  async flush(): Promise<void> {
    await this.unitOfWork.flush();
  }

  async commit(): Promise<void> {
    await this.unitOfWork.flush();
    await this.relationChanges.process();
    await this.unitOfWork.flush();
  }

  async rollback(): Promise<void> {
    // Implementation to be added
    throw new Error('Method not implemented');
  }

  // low level
  getExecutionContext(): ExecutionContext {
    return {
      dialect: this.orm.dialect,
      executor: this.executorWithLogging,
      interceptors: this.orm.interceptors
    };
  }

  getHydrationContext(): HydrationContext {
    return {
      identityMap: this.identityMap,
      unitOfWork: this.unitOfWork,
      domainEvents: this.domainEvents,
      relationChanges: this.relationChanges
    };
  }
}
