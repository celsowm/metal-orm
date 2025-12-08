import type { Dialect } from '../dialect/abstract.js';
import type { SchemaDialect } from '../ddl/schema-dialect.js';
import type { SchemaIntrospector } from '../ddl/schema-introspect.js';

export interface DatabaseDriver {
  readonly name: string; // e.g. "postgres"

  createDialect(): Dialect;
  createSchemaDialect(): SchemaDialect;
  createIntrospector(): SchemaIntrospector;
}
