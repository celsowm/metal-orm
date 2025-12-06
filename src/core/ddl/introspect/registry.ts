import type { DialectName } from '../schema-generator.js';
import type { SchemaIntrospector } from './types.js';
import { postgresIntrospector } from './postgres.js';
import { mysqlIntrospector } from './mysql.js';
import { sqliteIntrospector } from './sqlite.js';
import { mssqlIntrospector } from './mssql.js';

const registry = new Map<DialectName, SchemaIntrospector>();

const registerBuiltInIntrospectors = () => {
  registry.set('postgres', postgresIntrospector);
  registry.set('mysql', mysqlIntrospector);
  registry.set('sqlite', sqliteIntrospector);
  registry.set('mssql', mssqlIntrospector);
};

registerBuiltInIntrospectors();

export const registerSchemaIntrospector = (dialect: DialectName, introspector: SchemaIntrospector): void => {
  registry.set(dialect, introspector);
};

export const getSchemaIntrospector = (dialect: DialectName): SchemaIntrospector | undefined => {
  return registry.get(dialect);
};

