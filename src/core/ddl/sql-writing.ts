import type { TableDef, IndexColumn } from '../../schema/table.js';
import type { ColumnDef, RawDefaultValue } from '../../schema/column-types.js';

/**
 * Minimal surface for anything that can quote identifiers.
 * Implemented by SchemaDialect, runtime Dialect, etc.
 */
export interface Quoter {
  quoteIdentifier(id: string): string;
}

/**
 * Escape a value to be safe inside a single-quoted SQL literal.
 * Purely mechanical; no dialect knowledge.
 */
export const escapeSqlString = (value: string): string =>
  value.replace(/'/g, "''");

/**
 * Narrow a value to the RawDefaultValue shape.
 * This is domain-specific but dialect-agnostic.
 */
export const isRawDefault = (value: unknown): value is RawDefaultValue =>
  typeof value === 'object' &&
  value !== null &&
  'raw' in value &&
  typeof (value as RawDefaultValue).raw === 'string';

/**
 * Abstraction for "how do I turn values into SQL literals".
 * Implemented or configured by each dialect.
 */
export interface LiteralFormatter {
  formatLiteral(value: unknown): string;
}

/**
 * Declarative options for building a LiteralFormatter.
 * Dialects configure behavior by data, not by being hard-coded here.
 */
export interface LiteralFormatOptions {
  nullLiteral?: string; // default: 'NULL'
  booleanTrue?: string; // default: 'TRUE'
  booleanFalse?: string; // default: 'FALSE'

  numberFormatter?: (value: number) => string;
  dateFormatter?: (value: Date) => string;
  stringWrapper?: (escaped: string) => string; // how to wrap an escaped string
  jsonWrapper?: (escaped: string) => string;   // how to wrap escaped JSON
}

/**
 * Factory for a value-based LiteralFormatter that:
 * - Handles type dispatch (null/number/boolean/date/string/object/raw)
 * - Delegates representation choices to options
 * - Knows nothing about concrete dialects
 */
export const createLiteralFormatter = (
  options: LiteralFormatOptions = {}
): LiteralFormatter => {
  const {
    nullLiteral = 'NULL',
    booleanTrue = 'TRUE',
    booleanFalse = 'FALSE',

    numberFormatter = (value: number): string =>
      Number.isFinite(value) ? String(value) : nullLiteral,

    dateFormatter = (value: Date): string =>
      `'${escapeSqlString(value.toISOString())}'`,

    stringWrapper = (escaped: string): string => `'${escaped}'`,
    jsonWrapper = (escaped: string): string => `'${escaped}'`,
  } = options;

  const wrapString = stringWrapper;
  const wrapJson = jsonWrapper;

  const format = (value: unknown): string => {
    // Domain rule: raw defaults bypass all formatting.
    if (isRawDefault(value)) return value.raw;

    if (value === null) return nullLiteral;

    if (typeof value === 'number') {
      return numberFormatter(value);
    }

    if (typeof value === 'boolean') {
      return value ? booleanTrue : booleanFalse;
    }

    if (value instanceof Date) {
      return dateFormatter(value);
    }

    if (typeof value === 'string') {
      return wrapString(escapeSqlString(value));
    }

    // Fallback: serialize to JSON then treat as string.
    return wrapJson(escapeSqlString(JSON.stringify(value)));
  };

  return {
    formatLiteral: format,
  };
};

/**
 * Convenience wrapper if you prefer a functional style at call-sites.
 */
export const formatLiteral = (
  formatter: LiteralFormatter,
  value: unknown
): string => formatter.formatLiteral(value);

/**
 * Quotes a possibly qualified identifier like "schema.table" or "db.schema.table"
 * using a Quoter that knows how to quote a single segment.
 */
export const quoteQualified = (quoter: Quoter, identifier: string): string => {
  const parts = identifier.split('.');
  return parts.map(part => quoter.quoteIdentifier(part)).join('.');
};

/**
 * Renders index column list, including optional order / nulls, using the
 * provided Quoter for identifier quoting.
 */
export const renderIndexColumns = (
  quoter: Quoter,
  columns: (string | IndexColumn)[]
): string =>
  columns
    .map(col => {
      if (typeof col === 'string') {
        return quoter.quoteIdentifier(col);
      }

      const parts: string[] = [quoter.quoteIdentifier(col.column)];

      if (col.order) {
        parts.push(col.order);
      }

      if (col.nulls) {
        parts.push(`NULLS ${col.nulls}`);
      }

      return parts.join(' ');
    })
    .join(', ');

/**
 * Resolves the primary key column names for a table, based purely on schema
 * metadata. This is domain logic, but independent from any dialect.
 */
export const resolvePrimaryKey = (table: TableDef): string[] => {
  if (Array.isArray(table.primaryKey) && table.primaryKey.length > 0) {
    return table.primaryKey;
  }

  const columns = Object.values(table.columns ?? {}) as ColumnDef[];

  // `primary` / `name` are domain-level properties of ColumnDef.
  return columns
    .filter(col => col.primary)
    .map(col => col.name);
};

