import type { ColumnDef } from './column-types.js';
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
  beforeInsert?(ctx: unknown, entity: unknown): Promise<void> | void;
  afterInsert?(ctx: unknown, entity: unknown): Promise<void> | void;
  beforeUpdate?(ctx: unknown, entity: unknown): Promise<void> | void;
  afterUpdate?(ctx: unknown, entity: unknown): Promise<void> | void;
  beforeDelete?(ctx: unknown, entity: unknown): Promise<void> | void;
  afterDelete?(ctx: unknown, entity: unknown): Promise<void> | void;
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
    const colDef = { ...def, name: key, table: name };
    (acc as Record<string, unknown>)[key] = colDef;
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

const TABLE_REF_CACHE: WeakMap<object, unknown> = new WeakMap();

const withColumnProps = <T extends TableDef>(table: T): TableRef<T> => {
  const cached = TABLE_REF_CACHE.get(table);
  if (cached) return cached as TableRef<T>;

  const proxy = new Proxy(table as object, {
    get(target, prop, receiver) {
      const t = target as TableDef;
      if (prop === "$") return t.columns;

      // Prefer real table fields first (prevents collision surprises)
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);

      // Fall back to columns bag
      if (typeof prop === "string" && prop in t.columns) return t.columns[prop];

      return undefined;
    },

    has(target, prop) {
      const t = target as TableDef;
      return (
        prop === "$" ||
        Reflect.has(target, prop) ||
        (typeof prop === "string" && prop in t.columns)
      );
    },

    ownKeys(target) {
      const t = target as TableDef;
      const base = Reflect.ownKeys(target);
      const cols = Object.keys(t.columns);

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
            return (target as TableDef).columns;
          },
        };
      }

      if (
        typeof prop === "string" &&
        prop in (target as TableDef).columns &&
        !Reflect.has(target, prop)
      ) {
        return {
          configurable: true,
          enumerable: true,
          value: (target as TableDef).columns[prop],
          writable: false,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as TableRef<T>;

  TABLE_REF_CACHE.set(table, proxy);
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

/**
 * Public API: dynamic column lookup by string key.
 *
 * Useful when the column name is only known at runtime, or when a column name
 * collides with a real table field (e.g. "name").
 *
 * @example
 * ```ts
 * const t = tableRef(todos);
 * const key = runtimeKey();
 * where(eq(getColumn(t, key), 123));
 * // or: t.$.name (escape hatch)
 * ```
 */
export function getColumn<T extends TableDef, K extends keyof T['columns'] & string>(table: T, key: K): T['columns'][K];
export function getColumn<T extends TableDef>(table: T, key: string): ColumnDef;
export function getColumn<T extends TableDef>(table: T, key: string): ColumnDef {
  const col = table.columns[key] as ColumnDef | undefined;
  if (!col) {
    const tableName = table.name || '<unknown>';
    throw new Error(`Column '${key}' does not exist on table '${tableName}'`);
  }
  return col;
}
