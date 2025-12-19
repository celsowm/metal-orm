import { DatabaseDriver } from './database-driver.js';
import { MySqlDialect } from '../dialect/mysql/index.js';
import { MySqlSchemaDialect } from '../ddl/dialects/mysql-schema-dialect.js';
import { mysqlIntrospector } from '../ddl/introspect/mysql.js';

/**
 * Database driver for MySQL.
 */
export class MySqlDriver implements DatabaseDriver {
  readonly name = 'mysql';

  createDialect() {
    return new MySqlDialect();
  }

  createSchemaDialect() {
    return new MySqlSchemaDialect();
  }

  createIntrospector() {
    return mysqlIntrospector;
  }
}
