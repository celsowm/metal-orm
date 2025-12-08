import type { Dialect } from '../core/dialect/abstract.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';

export interface ExecutionContext {
  dialect: Dialect;
  executor: DbExecutor;
  interceptors: InterceptorPipeline;
  // plus anything *purely about executing SQL*:
  // - logging
  // - query timeout config
}
