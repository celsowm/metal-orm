import { DatabaseDriver } from './database-driver.js';
import { SqliteDialect } from '../dialect/sqlite/index.js';
import { SQLiteSchemaDialect } from '../ddl/dialects/sqlite-schema-dialect.js';
import { sqliteIntrospector } from '../ddl/introspect/sqlite.js';

export class SqliteDriver implements DatabaseDriver {
  readonly name = 'sqlite';

  createDialect() {
    return new SqliteDialect();
  }

  createSchemaDialect() {
    return new SQLiteSchemaDialect();
  }

  createIntrospector() {
    return sqliteIntrospector;
  }
}
