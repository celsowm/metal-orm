import type { DomainEvent, OrmDomainEvent } from './runtime-types.js';
import type { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import type { NamingStrategy } from '../codegen/naming-strategy.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';
import { DefaultNamingStrategy } from '../codegen/naming-strategy.js';
import { OrmSession } from './orm-session.js';

/**
 * Options for creating an ORM instance.
 */
export interface OrmOptions {
  /** The database dialect */
  dialect: Dialect;
  /** The database executor factory */
  executorFactory: DbExecutorFactory;
  /** Optional interceptors pipeline */
  interceptors?: InterceptorPipeline;
  /** Optional naming strategy */
  namingStrategy?: NamingStrategy;
  // model registrations etc.
}

/**
 * Database executor factory interface.
 */
export interface DbExecutorFactory {
  /**
   * Creates a database executor.
   * @returns The database executor
   */
  createExecutor(): DbExecutor;

  /**
   * Creates a transactional database executor.
   * @returns The transactional database executor
   */
  createTransactionalExecutor(): DbExecutor;

  /**
   * Disposes any underlying resources (connection pools, background timers, etc).
   */
  dispose(): Promise<void>;
}

/**
 * ORM (Object-Relational Mapping) main class.
 * @template E - The domain event type
 */
export class Orm<E extends DomainEvent = OrmDomainEvent> {
  /** The database dialect */
  readonly dialect: Dialect;
  /** The interceptors pipeline */
  readonly interceptors: InterceptorPipeline;
  /** The naming strategy */
  readonly namingStrategy: NamingStrategy;
  private readonly executorFactory: DbExecutorFactory;

  /**
   * Creates a new ORM instance.
   * @param opts - ORM options
   */
  constructor(opts: OrmOptions) {
    this.dialect = opts.dialect;
    this.interceptors = opts.interceptors ?? new InterceptorPipeline();
    this.namingStrategy = opts.namingStrategy ?? new DefaultNamingStrategy();
    this.executorFactory = opts.executorFactory;
  }

  /**
   * Creates a new ORM session.
   * @param options - Optional session options
   * @returns The ORM session
   */
  createSession(): OrmSession<E> {
    // No implicit transaction binding; callers should use Orm.transaction() for transactional work.
    const executor = this.executorFactory.createExecutor();
    return new OrmSession<E>({ orm: this, executor });
  }

  /**
   * Executes a function within a transaction.
   * @template T - The return type
   * @param fn - The function to execute
   * @returns The result of the function
   * @throws If the transaction fails
   */
  async transaction<T>(fn: (session: OrmSession<E>) => Promise<T>): Promise<T> {
    const executor = this.executorFactory.createTransactionalExecutor();
    const session = new OrmSession<E>({ orm: this, executor });
    try {
      // A real transaction scope: begin before running user code, commit/rollback after.
      return await session.transaction(() => fn(session));
    } catch (err) {
      throw err;
    } finally {
      await session.dispose();
    }
  }

  /**
   * Shuts down the ORM and releases underlying resources (pools, timers).
   */
  async dispose(): Promise<void> {
    await this.executorFactory.dispose();
  }
}
