import type { DialectName } from './schema-generator.js';
import { DatabaseSchema } from './schema-types.js';
import { DbExecutor } from '../execution/db-executor.js';
import type { IntrospectOptions, SchemaIntrospector, IntrospectContext } from './introspect/types.js';
import { getSchemaIntrospector } from './introspect/registry.js';
import { DialectFactory } from '../dialect/dialect-factory.js';

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
  const dialectInstance = DialectFactory.create(dialect);
  const ctx: IntrospectContext = { executor, dialect: dialectInstance };
  return handler.introspect(ctx, options);
};

export type { IntrospectOptions, SchemaIntrospector };
