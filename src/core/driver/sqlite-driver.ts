import type { DatabaseDriver } from './database-driver.js';
import { createSqliteDialect } from '../dialect/sqlite/index.js';
import { createSqliteSchemaDialect } from '../ddl/dialects/sqlite-schema-dialect.js';
import { sqliteIntrospector } from '../ddl/introspect/sqlite.js';

/** Database driver for SQLite. */
export class SqliteDriver implements DatabaseDriver {
  readonly name = 'sqlite';

  createDialect() {
    return createSqliteDialect();
  }

  createSchemaDialect() {
    return createSqliteSchemaDialect();
  }

  createIntrospector() {
    return sqliteIntrospector;
  }
}
