import type { DialectName } from '../schema-generator.js';
import type { DbExecutor } from '../../../orm/db-executor.js';

export interface IntrospectContext {
  dialect: DialectName;
  executor: DbExecutor;
}

export default IntrospectContext;
