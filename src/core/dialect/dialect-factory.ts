// Dialect factory for the SQL DSL.
// Centralizes how we go from a symbolic name ("sqlite") to a structural Dialect.

import type { Dialect } from './abstract.js';
import { createPostgresDialect } from './postgres/index.js';
import { createMySqlDialect } from './mysql/index.js';
import { createSqliteDialect } from './sqlite/index.js';
import { createSqlServerDialect } from './mssql/index.js';

export type DialectKey =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | (string & {});

export type DialectFactoryFn = () => Dialect;

export class DialectFactory {
  private static registry = new Map<DialectKey, DialectFactoryFn>();
  private static defaultsInitialized = false;

  private static ensureDefaults(): void {
    if (this.defaultsInitialized) return;
    this.defaultsInitialized = true;

    if (!this.registry.has('postgres')) this.registry.set('postgres', createPostgresDialect);
    if (!this.registry.has('mysql')) this.registry.set('mysql', createMySqlDialect);
    if (!this.registry.has('sqlite')) this.registry.set('sqlite', createSqliteDialect);
    if (!this.registry.has('mssql')) this.registry.set('mssql', createSqlServerDialect);
  }

  /** Register or replace a structural dialect factory. */
  public static register(key: DialectKey, factory: DialectFactoryFn): void {
    this.registry.set(key, factory);
  }

  /** Resolve a key into a new Dialect instance. */
  public static create(key: DialectKey): Dialect {
    this.ensureDefaults();
    const factory = this.registry.get(key);
    if (!factory) {
      throw new Error(
        `Dialect "${String(key)}" is not registered. Use DialectFactory.register(...) to register it.`
      );
    }
    return factory();
  }

  /** Clear registrations; built-ins are restored lazily on the next create(). */
  public static clear(): void {
    this.registry.clear();
    this.defaultsInitialized = false;
  }
}

export const resolveDialectInput = (dialect: Dialect | DialectKey): Dialect =>
  typeof dialect === 'string' ? DialectFactory.create(dialect) : dialect;
