/**
 * Filter types for building type-safe query filters from JSON input.
 * Designed for REST API query parameters.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef, ColumnType } from '../schema/column-types.js';
import type { EntityConstructor } from '../orm/entity-metadata.js';

// ─────────────────────────────────────────────────────────────────────────────
// Entity support: Extract columns from entity constructor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a type is a TableDef.
 */
type IsTableDef<T> = T extends { name: string; columns: Record<string, unknown> } ? true : false;

/**
 * Maps TypeScript types to SQL column types for EntityConstructor columns.
 */
type TsTypeToColumnType<T> =
  T extends string ? 'VARCHAR' :
  T extends number ? 'INT' :
  T extends boolean ? 'BOOLEAN' :
  T extends Date ? 'TIMESTAMP' :
  'VARCHAR';

/**
 * Extracts the column map from either a TableDef or EntityConstructor.
 * For EntityConstructor, infers column type from TypeScript property type.
 */
type ExtractColumns<T> = IsTableDef<T> extends true
  ? T extends TableDef<infer C> ? C : never
  : T extends EntityConstructor<infer E>
  ? {
      [K in keyof E]: ColumnDef<TsTypeToColumnType<E[K]>, E[K]>;
    }
  : never;

// ─────────────────────────────────────────────────────────────────────────────
// Scalar filter types per data type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter operators for string columns.
 */
export interface StringFilter {
  equals?: string;
  not?: string;
  in?: string[];
  notIn?: string[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  /** Case-insensitive matching (for contains, startsWith, endsWith) */
  mode?: 'default' | 'insensitive';
}

/**
 * Filter operators for numeric columns (number, bigint).
 */
export interface NumberFilter {
  equals?: number;
  not?: number;
  in?: number[];
  notIn?: number[];
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
}

/**
 * Filter operators for boolean columns.
 */
export interface BooleanFilter {
  equals?: boolean;
  not?: boolean;
}

/**
 * Filter operators for date/datetime columns.
 * Accepts ISO date strings.
 */
export interface DateFilter {
  equals?: string;
  not?: string;
  in?: string[];
  notIn?: string[];
  lt?: string;
  lte?: string;
  gt?: string;
  gte?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type mapping: ColumnDef → appropriate filter type
// ─────────────────────────────────────────────────────────────────────────────

type NormalizedType<T extends ColumnDef> = Lowercase<T['type'] & string>;

/**
 * Maps a column definition to its appropriate filter type.
 */
export type FieldFilter<TCol extends ColumnDef> =
  NormalizedType<TCol> extends 'int' | 'integer' | 'bigint' | 'decimal' | 'float' | 'double'
    ? NumberFilter
  : NormalizedType<TCol> extends 'boolean'
    ? BooleanFilter
  : NormalizedType<TCol> extends 'date' | 'datetime' | 'timestamp' | 'timestamptz'
    ? DateFilter
  : StringFilter; // default to string for varchar, text, uuid, etc.

// ─────────────────────────────────────────────────────────────────────────────
// SimpleWhereInput: field-only filters (no AND/OR/NOT logic)
// ─────────────────────────────────────────────────────────────────────────────

type RelationKeys<T> = T extends TableDef ? keyof T['relations'] : never;

type ColumnFilter<T extends TableDef | EntityConstructor> = {
  [K in keyof ExtractColumns<T>]?: ExtractColumns<T>[K] extends ColumnDef<ColumnType, unknown>
    ? FieldFilter<ExtractColumns<T>[K]>
    : never;
};

type RelationFilterInput<T extends TableDef | EntityConstructor> = {
  [K in RelationKeys<T>]?: T extends TableDef
    ? T['relations'][K] extends { target: infer TargetTable extends TableDef }
      ? RelationFilter<TargetTable>
      : never
    : never;
};

export type WhereInput<T extends TableDef | EntityConstructor> = 
  | ColumnFilter<T>
  | RelationFilterInput<T>
  | (ColumnFilter<T> & RelationFilterInput<T>);

/**
 * Restricted where input - only specified columns are filterable.
 * Use this to limit which fields can be filtered via API.
 *
 * Works with both TableDef and EntityConstructor.
 *
 * @example
 * ```ts
 * // With TableDef - only allow filtering by name and email
 * type UserFilter = SimpleWhereInput<typeof usersTable, 'name' | 'email'>;
 *
 * // With Entity class
 * type UserFilter = SimpleWhereInput<User, 'name' | 'email'>;
 *
 * // Request: { "name": { "contains": "john" }, "email": { "endsWith": "@gmail.com" } }
 * ```
 */
export type SimpleWhereInput<
  T extends TableDef | EntityConstructor,
  K extends keyof ExtractColumns<T>
> = {
  [P in K]?: ExtractColumns<T>[P] extends ColumnDef<ColumnType, unknown>
    ? FieldFilter<ExtractColumns<T>[P]>
    : FieldFilter<ColumnDef<ColumnType, unknown>>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Relation filter types
// ─────────────────────────────────────────────────────────────────────────────

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Keys extends keyof T
    ? Required<Pick<T, Keys>> & Partial<Omit<T, Keys>>
    : never;

export type RelationFilter<TargetTable extends TableDef = TableDef> = RequireAtLeastOne<{
  some?: WhereInput<TargetTable>;
  every?: WhereInput<TargetTable>;
  none?: WhereInput<TargetTable>;
  isEmpty?: boolean;
  isNotEmpty?: boolean;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Filter operator value types (for runtime processing)
// ─────────────────────────────────────────────────────────────────────────────

export type FilterOperator =
  | 'equals'
  | 'not'
  | 'in'
  | 'notIn'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

/**
 * Generic filter value that covers all operator types.
 */
export type FilterValue = StringFilter | NumberFilter | BooleanFilter | DateFilter;
