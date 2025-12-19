import type { Dialect } from '../dialect/abstract.js';
import type { SchemaDialect } from '../ddl/schema-dialect.js';
import type { SchemaIntrospector } from '../ddl/schema-introspect.js';

/**
 * Interface for database drivers.
 * A driver provides access to dialect-specific compilers and introspectors.
 */
export interface DatabaseDriver {
  /** The name of the driver (e.g., "postgres", "mysql"). */
  readonly name: string;

  /** Creates a query compiler dialect. */
  createDialect(): Dialect;
  /** Creates a DDL/schema dialect. */
  createSchemaDialect(): SchemaDialect;
  /** Creates a schema introspector. */
  createIntrospector(): SchemaIntrospector;
}
