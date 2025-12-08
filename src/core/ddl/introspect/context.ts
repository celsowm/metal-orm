import type { Dialect } from '../../dialect/abstract.js';
import type { DbExecutor } from '../../execution/db-executor.js';

export interface IntrospectContext {
  dialect: Dialect;
  executor: DbExecutor;
}

export default IntrospectContext;
