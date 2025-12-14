import type { ColumnDef } from './column.js';
import type { RelationDef } from './relation.js';

export interface IndexColumn {
  column: string;
  order?: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface IndexDef {
  name?: string;
  columns: (string | IndexColumn)[];
  unique?: boolean;
  where?: string;
}

export interface CheckConstraint {
  name?: string;
  expression: string;
}

export interface TableOptions {
  schema?: string;
  primaryKey?: string[];
  indexes?: IndexDef[];
  checks?: CheckConstraint[];
  comment?: string;
  engine?: string;
  charset?: string;
  collation?: string;
}

export interface TableHooks {
  beforeInsert?(ctx: unknown, entity: any): Promise<void> | void;
  afterInsert?(ctx: unknown, entity: any): Promise<void> | void;
  beforeUpdate?(ctx: unknown, entity: any): Promise<void> | void;
  afterUpdate?(ctx: unknown, entity: any): Promise<void> | void;
  beforeDelete?(ctx: unknown, entity: any): Promise<void> | void;
  afterDelete?(ctx: unknown, entity: any): Promise<void> | void;
}

/**
 * Definition of a database table with its columns and relationships
 * @typeParam T - Type of the columns record
 */
export interface TableDef<T extends Record<string, ColumnDef> = Record<string, ColumnDef>> {
  /** Name of the table */
  name: string;
  /** Optional schema/catalog name */
  schema?: string;
  /** Record of column definitions keyed by column name */
  columns: T;
  /** Record of relationship definitions keyed by relation name */
  relations: Record<string, RelationDef>;
  /** Optional lifecycle hooks */
  hooks?: TableHooks;
  /** Composite primary key definition (falls back to column.primary flags) */
  primaryKey?: string[];
  /** Secondary indexes */
  indexes?: IndexDef[];
  /** Table-level check constraints */
  checks?: CheckConstraint[];
  /** Table comment/description */
  comment?: string;
  /** Dialect-specific options */
  engine?: string;
  charset?: string;
  collation?: string;
}

/**
 * Creates a table definition with columns and relationships
 * @typeParam T - Type of the columns record
 * @param name - Name of the table
 * @param columns - Record of column definitions
 * @param relations - Record of relationship definitions (optional)
 * @returns Complete table definition with runtime-filled column metadata
 *
 * @example
 * ```typescript
 * const usersTable = defineTable('users', {
 *   id: col.primaryKey(col.int()),
 *   name: col.varchar(255),
 *   email: col.varchar(255)
 * });
 * ```
 */
export const defineTable = <T extends Record<string, ColumnDef>>(
  name: string,
  columns: T,
  relations: Record<string, RelationDef> = {},
  hooks?: TableHooks,
  options: TableOptions = {}
): TableDef<T> => {
  // Runtime mutability to assign names to column definitions for convenience
  const colsWithNames = Object.entries(columns).reduce((acc, [key, def]) => {
    (acc as any)[key] = { ...def, name: key, table: name };
    return acc;
  }, {} as T);

  return {
    name,
    schema: options.schema,
    columns: colsWithNames,
    relations,
    hooks,
    primaryKey: options.primaryKey,
    indexes: options.indexes,
    checks: options.checks,
    comment: options.comment,
    engine: options.engine,
    charset: options.charset,
    collation: options.collation
  };
};

type DirectColumnKeys<T extends TableDef> =
  Exclude<keyof T["columns"] & string, keyof T | "$">;

export type TableRef<T extends TableDef> =
  T &
  { [K in DirectColumnKeys<T>]: T["columns"][K] } & {
    /**
     * Escape hatch for collisions:
     * - tref.name  => table name (string)
     * - tref.$.name => column def for "name"
     */
    $: T["columns"];
  };

const TABLE_REF_CACHE: WeakMap<object, any> = new WeakMap();

const withColumnProps = <T extends TableDef>(table: T): TableRef<T> => {
  const cached = TABLE_REF_CACHE.get(table as any);
  if (cached) return cached as TableRef<T>;

  const proxy = new Proxy(table as any, {
    get(target, prop, receiver) {
      if (prop === "$") return target.columns;

      // Prefer real table fields first (prevents collision surprises)
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);

      // Fall back to columns bag
      if (typeof prop === "string" && prop in target.columns) return target.columns[prop];

      return undefined;
    },

    has(target, prop) {
      return (
        prop === "$" ||
        Reflect.has(target, prop) ||
        (typeof prop === "string" && prop in target.columns)
      );
    },

    ownKeys(target) {
      const base = Reflect.ownKeys(target);
      const cols = Object.keys(target.columns);

      for (const k of cols) {
        if (!base.includes(k)) base.push(k);
      }
      if (!base.includes("$")) base.push("$");
      return base;
    },

    getOwnPropertyDescriptor(target, prop) {
      if (prop === "$") {
        return {
          configurable: true,
          enumerable: false,
          get() {
            return target.columns;
          },
        };
      }

      if (
        typeof prop === "string" &&
        prop in target.columns &&
        !Reflect.has(target, prop)
      ) {
        return {
          configurable: true,
          enumerable: true,
          value: target.columns[prop],
          writable: false,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as TableRef<T>;

  TABLE_REF_CACHE.set(table as any, proxy);
  return proxy;
};

/**
 * Public API: opt-in ergonomic table reference.
 * Usage:
 *   const t = tableRef(todos);
 *   qb.where(eq(t.done, false)).orderBy(t.id, "ASC");
 * Collisions:
 *   t.name is the table name (real field)
 *   t.$.name is the "name" column (escape hatch)
 */
export const tableRef = <T extends TableDef>(table: T): TableRef<T> => withColumnProps(table);
