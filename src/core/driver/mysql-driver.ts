import type { DatabaseDriver } from './database-driver.js';
import { createMySqlDialect } from '../dialect/mysql/index.js';
import { createMySqlSchemaDialect } from '../ddl/dialects/mysql-schema-dialect.js';
import { mysqlIntrospector } from '../ddl/introspect/mysql.js';

/** Database driver for MySQL. */
export class MySqlDriver implements DatabaseDriver {
  readonly name = 'mysql';

  createDialect() {
    return createMySqlDialect();
  }

  createSchemaDialect() {
    return createMySqlSchemaDialect();
  }

  createIntrospector() {
    return mysqlIntrospector;
  }
}
