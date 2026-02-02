import { DatabaseSchema } from '../schema-types.js';
import type { IntrospectContext } from './context.js';

export type { IntrospectContext };

/**
 * Dialect-agnostic options for schema introspection.
 */
export interface IntrospectOptions {
  /** Dialect-specific schema/catalog. Postgres: schema; MySQL: database; MSSQL: schema. */
  schema?: string;
  includeTables?: string[];
  excludeTables?: string[];
  /** Include database views in introspection. */
  includeViews?: boolean;
  /** Views to exclude from introspection. */
  excludeViews?: string[];
}

/**
 * Strategy interface implemented per dialect to introspect an existing database schema.
 */
export interface SchemaIntrospector {
  // Requires IntrospectContext with both dialect and executor
  introspect(ctx: IntrospectContext, options: IntrospectOptions): Promise<DatabaseSchema>;
}
