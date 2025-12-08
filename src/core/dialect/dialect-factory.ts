// Dialect factory for the SQL DSL.
// Centralizes how we go from a symbolic name ("sqlite") to a concrete Dialect instance.

import { Dialect } from './abstract.js';
import { PostgresDialect } from './postgres/index.js';
import { MySqlDialect } from './mysql/index.js';
import { SqliteDialect } from './sqlite/index.js';
import { SqlServerDialect } from './mssql/index.js';

export type DialectKey =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | (string & {}); // allow user-defined keys without constraining too much

type DialectFactoryFn = () => Dialect;

export class DialectFactory {
  private static registry = new Map<DialectKey, DialectFactoryFn>();
  private static defaultsInitialized = false;

  private static ensureDefaults(): void {
    if (this.defaultsInitialized) return;
    this.defaultsInitialized = true;

    // Register built-in dialects only if no override exists yet.
    if (!this.registry.has('postgres')) {
      this.registry.set('postgres', () => new PostgresDialect());
    }
    if (!this.registry.has('mysql')) {
      this.registry.set('mysql', () => new MySqlDialect());
    }
    if (!this.registry.has('sqlite')) {
      this.registry.set('sqlite', () => new SqliteDialect());
    }
    if (!this.registry.has('mssql')) {
      this.registry.set('mssql', () => new SqlServerDialect());
    }
  }

  /**
   * Register (or override) a dialect factory for a key.
   *
   * Examples:
   *   DialectFactory.register('sqlite', () => new SqliteDialect());
   *   DialectFactory.register('my-tenant-dialect', () => new CustomDialect());
   */
  public static register(key: DialectKey, factory: DialectFactoryFn): void {
    this.registry.set(key, factory);
  }

  /**
   * Resolve a key into a Dialect instance.
   * Throws if the key is not registered.
   */
  public static create(key: DialectKey): Dialect {
    this.ensureDefaults();
    const factory = this.registry.get(key);
    if (!factory) {
      throw new Error(
        `Dialect "${String(
          key
        )}" is not registered. Use DialectFactory.register(...) to register it.`
      );
    }
    return factory();
  }

  /**
   * Clear all registrations (mainly for tests).
   * Built-ins will be re-registered lazily on the next create().
   */
  public static clear(): void {
    this.registry.clear();
    this.defaultsInitialized = false;
  }
}

/**
 * Helper to normalize either a Dialect instance OR a key into a Dialect instance.
 * This is what query builders will use.
 */
export const resolveDialectInput = (
  dialect: Dialect | DialectKey
): Dialect => {
  if (typeof dialect === 'string') {
    return DialectFactory.create(dialect);
  }
  return dialect;
};
