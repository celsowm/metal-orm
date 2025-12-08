import { DatabaseDriver } from './database-driver.js';
import { SqlServerDialect } from '../dialect/mssql/index.js';
import { MSSqlSchemaDialect } from '../ddl/dialects/mssql-schema-dialect.js';
import { mssqlIntrospector } from '../ddl/introspect/mssql.js';

export class MssqlDriver implements DatabaseDriver {
  readonly name = 'mssql';

  createDialect() {
    return new SqlServerDialect();
  }

  createSchemaDialect() {
    return new MSSqlSchemaDialect();
  }

  createIntrospector() {
    return mssqlIntrospector;
  }
}
