import type { DatabaseDriver } from './database-driver.js';
import { createSqlServerDialect } from '../dialect/mssql/index.js';
import { createMSSqlSchemaDialect } from '../ddl/dialects/mssql-schema-dialect.js';
import { mssqlIntrospector } from '../ddl/introspect/mssql.js';

/** Database driver for Microsoft SQL Server. */
export class MssqlDriver implements DatabaseDriver {
  readonly name = 'mssql';

  createDialect() {
    return createSqlServerDialect();
  }

  createSchemaDialect() {
    return createMSSqlSchemaDialect();
  }

  createIntrospector() {
    return mssqlIntrospector;
  }
}
