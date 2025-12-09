import type { DomainEvent, OrmDomainEvent } from './runtime-types.js';
import type { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import type { NamingStrategy } from '../codegen/naming-strategy.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';
import { DefaultNamingStrategy } from '../codegen/naming-strategy.js';
import { OrmSession } from './orm-session.js';

export interface OrmOptions<E extends DomainEvent = OrmDomainEvent> {
  dialect: Dialect;
  executorFactory: DbExecutorFactory;
  interceptors?: InterceptorPipeline;
  namingStrategy?: NamingStrategy;
  // model registrations etc.
}

export interface DbExecutorFactory {
  createExecutor(options?: { tx?: ExternalTransaction }): DbExecutor;
  createTransactionalExecutor(): DbExecutor;
}

export interface ExternalTransaction {
  // Transaction-specific properties
}

export class Orm<E extends DomainEvent = OrmDomainEvent> {
  readonly dialect: Dialect;
  readonly interceptors: InterceptorPipeline;
  readonly namingStrategy: NamingStrategy;
  private readonly executorFactory: DbExecutorFactory;

  constructor(opts: OrmOptions<E>) {
    this.dialect = opts.dialect;
    this.interceptors = opts.interceptors ?? new InterceptorPipeline();
    this.namingStrategy = opts.namingStrategy ?? new DefaultNamingStrategy();
    this.executorFactory = opts.executorFactory;
  }

  createSession(options?: { tx?: ExternalTransaction }): OrmSession<E> {
    const executor = this.executorFactory.createExecutor(options?.tx);
    return new OrmSession<E>({ orm: this, executor });
  }

  async transaction<T>(fn: (session: OrmSession<E>) => Promise<T>): Promise<T> {
    const executor = this.executorFactory.createTransactionalExecutor();
    const session = new OrmSession<E>({ orm: this, executor });
    try {
      const result = await fn(session);
      await session.commit();
      return result;
    } catch (err) {
      await session.rollback();
      throw err;
    } finally {
      // executor cleanup if needed
    }
  }
}
