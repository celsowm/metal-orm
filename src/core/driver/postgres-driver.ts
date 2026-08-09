import type { DatabaseDriver } from './database-driver.js';
import { createPostgresDialect } from '../dialect/postgres/index.js';
import { createPostgresSchemaDialect } from '../ddl/dialects/postgres-schema-dialect.js';
import { postgresIntrospector } from '../ddl/introspect/postgres.js';

/** Database driver for PostgreSQL. */
export class PostgresDriver implements DatabaseDriver {
  readonly name = 'postgres';

  createDialect() {
    return createPostgresDialect();
  }

  createSchemaDialect() {
    return createPostgresSchemaDialect();
  }

  createIntrospector() {
    return postgresIntrospector;
  }
}
