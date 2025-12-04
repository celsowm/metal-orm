import type { DbExecutor } from '../../../orm/db-executor.js';
import { DatabaseSchema } from '../schema-types.js';

/**
 * Dialect-agnostic options for schema introspection.
 */
export interface IntrospectOptions {
  /** Dialect-specific schema/catalog. Postgres: schema; MySQL: database; MSSQL: schema. */
  schema?: string;
  includeTables?: string[];
  excludeTables?: string[];
}

/**
 * Strategy interface implemented per dialect to introspect an existing database schema.
 */
export interface SchemaIntrospector {
  introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema>;
}
