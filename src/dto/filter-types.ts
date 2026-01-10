/**
 * Filter types for building type-safe query filters from JSON input.
 * Designed for REST API query parameters.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';

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

/**
 * Full where input with all columns filterable.
 * All conditions are implicitly AND-ed.
 */
export type WhereInput<T extends TableDef> = {
  [K in keyof T['columns']]?: FieldFilter<T['columns'][K]>;
};

/**
 * Restricted where input - only specified columns are filterable.
 * Use this to limit which fields can be filtered via API.
 *
 * @example
 * ```ts
 * // Only allow filtering by name and email
 * type UserFilter = SimpleWhereInput<typeof User, 'name' | 'email'>;
 *
 * // Request: { "name": { "contains": "john" }, "email": { "endsWith": "@gmail.com" } }
 * ```
 */
export type SimpleWhereInput<
  T extends TableDef,
  K extends keyof T['columns']
> = {
  [P in K]?: FieldFilter<T['columns'][P]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter operator value types (for runtime processing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible filter operators.
 */
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
