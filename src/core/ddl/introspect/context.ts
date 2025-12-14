import type { Dialect } from '../../dialect/abstract.js';
import type { DbExecutor } from '../../execution/db-executor.js';

/**
 * Context for schema introspection operations.
 * Provides the necessary components to perform database schema introspection.
 */
export interface IntrospectContext {
  /** The database dialect used for introspection. */
  dialect: Dialect;
  /** The database executor for running introspection queries. */
  executor: DbExecutor;
}

export default IntrospectContext;
