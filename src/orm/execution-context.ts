import type { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';

/**
 * Context for SQL query execution
 */
export interface ExecutionContext {
  /** Database dialect to use for SQL generation */
  dialect: Dialect;
  /** Database executor for running SQL queries */
  executor: DbExecutor;
  /** Interceptor pipeline for query processing */
  interceptors: InterceptorPipeline;
  // plus anything *purely about executing SQL*:
  // - logging
  // - query timeout config
}
