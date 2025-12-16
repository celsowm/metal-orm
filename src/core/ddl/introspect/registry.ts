import type { DialectName } from '../schema-generator.js';
import type { SchemaIntrospector } from './types.js';
import { postgresIntrospector } from './postgres.js';
import { mysqlIntrospector } from './mysql.js';
import { sqliteIntrospector } from './sqlite.js';
import { mssqlIntrospector } from './mssql.js';

/** Registry mapping dialect names to their corresponding schema introspectors. */
const registry = new Map<DialectName, SchemaIntrospector>();

/**
 * Registers the built-in schema introspectors for all supported database dialects.
 */
const registerBuiltInIntrospectors = () => {
  registry.set('postgres', postgresIntrospector);
  registry.set('mysql', mysqlIntrospector);
  registry.set('sqlite', sqliteIntrospector);
  registry.set('mssql', mssqlIntrospector);
};

registerBuiltInIntrospectors();

/**
 * Registers a schema introspector for a dialect.
 * @param dialect - The dialect name.
 * @param introspector - The schema introspector.
 */
export const registerSchemaIntrospector = (dialect: DialectName, introspector: SchemaIntrospector): void => {
  registry.set(dialect, introspector);
};

/**
 * Gets the schema introspector for a dialect.
 * @param dialect - The dialect name.
 * @returns The schema introspector or undefined if not found.
 */
export const getSchemaIntrospector = (dialect: DialectName): SchemaIntrospector | undefined => {
  return registry.get(dialect);
};

