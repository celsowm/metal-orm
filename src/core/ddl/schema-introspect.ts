import { DialectName } from './schema-generator.js';
import { DatabaseSchema } from './schema-types.js';
import { DbExecutor } from '../../orm/db-executor.js';
import type { IntrospectOptions, SchemaIntrospector } from './introspect/types.js';
import { postgresIntrospector } from './introspect/postgres.js';
import { mysqlIntrospector } from './introspect/mysql.js';
import { sqliteIntrospector } from './introspect/sqlite.js';
import { mssqlIntrospector } from './introspect/mssql.js';

const INTROSPECTORS: Record<DialectName, SchemaIntrospector> = {
  postgres: postgresIntrospector,
  mysql: mysqlIntrospector,
  sqlite: sqliteIntrospector,
  mssql: mssqlIntrospector
};

/**
 * Introspects an existing database schema using the dialect-specific strategy.
 */
export const introspectSchema = async (
  executor: DbExecutor,
  dialect: DialectName,
  options: IntrospectOptions = {}
): Promise<DatabaseSchema> => {
  const handler = INTROSPECTORS[dialect];
  if (!handler) {
    throw new Error(`Unsupported dialect for introspection: ${dialect}`);
  }
  return handler.introspect(executor, options);
};

export type { IntrospectOptions, SchemaIntrospector };
