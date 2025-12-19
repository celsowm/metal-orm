import { DatabaseDriver } from './database-driver.js';
import { PostgresDialect } from '../dialect/postgres/index.js';
import { PostgresSchemaDialect } from '../ddl/dialects/postgres-schema-dialect.js';
import { postgresIntrospector } from '../ddl/introspect/postgres.js';

/**
 * Database driver for PostgreSQL.
 */
export class PostgresDriver implements DatabaseDriver {
  readonly name = 'postgres';

  createDialect() {
    return new PostgresDialect();
  }

  createSchemaDialect() {
    return new PostgresSchemaDialect();
  }

  createIntrospector() {
    return postgresIntrospector;
  }
}
