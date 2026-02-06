import type { DomainEvent, OrmDomainEvent } from './runtime-types.js';
import type { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import type { NamingStrategy } from '../codegen/naming-strategy.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';
import { DefaultNamingStrategy } from '../codegen/naming-strategy.js';
import { OrmSession } from './orm-session.js';
import type { QueryCacheManager } from '../cache/query-cache-manager.js';
import type { Duration, CacheProvider, CacheStrategy } from '../cache/index.js';
import { QueryCacheManager as QueryCacheManagerImpl } from '../cache/query-cache-manager.js';
import { DefaultCacheStrategy } from '../cache/strategies/default-cache-strategy.js';

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
  /** Optional cache configuration */
  cache?: OrmCacheOptions;
}

/**
 * Cache configuration options for ORM
 */
export interface OrmCacheOptions {
  /** Cache provider (e.g., MemoryCacheAdapter, KeyvCacheAdapter) */
  provider: CacheProvider;
  /** Optional cache strategy (defaults to DefaultCacheStrategy) */
  strategy?: CacheStrategy;
  /** Default TTL for cached queries (e.g., '1h', '30m') */
  defaultTtl?: Duration;
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
  /** The cache manager (if configured) */
  readonly cacheManager?: QueryCacheManager;
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

    // Initialize cache manager if cache options provided
    if (opts.cache) {
      this.cacheManager = new QueryCacheManagerImpl(
        opts.cache.provider,
        opts.cache.strategy ?? new DefaultCacheStrategy(),
        opts.cache.defaultTtl ?? '1h'
      );
    }
  }

  /**
   * Creates a new ORM session.
   * @param options - Optional session options (e.g., tenantId for multi-tenancy)
   * @returns The ORM session
   */
  createSession(options?: { tenantId?: string | number }): OrmSession<E> {
    // No implicit transaction binding; callers should use Orm.transaction() for transactional work.
    const executor = this.executorFactory.createExecutor();
    return new OrmSession<E>({ 
      orm: this, 
      executor,
      cacheManager: this.cacheManager,
      tenantId: options?.tenantId
    });
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
    const session = new OrmSession<E>({ 
      orm: this, 
      executor,
      cacheManager: this.cacheManager
    });
    try {
      // A real transaction scope: begin before running user code, commit/rollback after.
      return await session.transaction(() => fn(session));
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
