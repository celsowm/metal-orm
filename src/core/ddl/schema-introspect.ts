import { DialectName } from './schema-generator.js';
import { DatabaseSchema } from './schema-types.js';
import { DbExecutor } from '../../orm/db-executor.js';
import type { IntrospectOptions, SchemaIntrospector } from './introspect/types.js';
import { getSchemaIntrospector } from './introspect/registry.js';

/**
 * Introspects an existing database schema using the dialect-specific strategy.
 */
export const introspectSchema = async (
  executor: DbExecutor,
  dialect: DialectName,
  options: IntrospectOptions = {}
): Promise<DatabaseSchema> => {
  const handler = getSchemaIntrospector(dialect);
  if (!handler) {
    throw new Error(`Unsupported dialect for introspection: ${dialect}`);
  }
  return handler.introspect(executor, options);
};

export type { IntrospectOptions, SchemaIntrospector };
