import type { TableDef, IndexColumn, IndexDef } from '../../schema/table.js';
import type { ColumnDef, RawDefaultValue, ForeignKeyReference } from '../../schema/column.js';
import type { DialectName } from './schema-dialect.js';

// Minimal surface that dialects & generator both satisfy
export interface Quoter {
  quoteIdentifier(id: string): string;
}

export const escapeLiteral = (value: string): string =>
  value.replace(/'/g, "''");

export const isRawDefault = (value: unknown): value is RawDefaultValue =>
  typeof value === 'object' &&
  value !== null &&
  'raw' in value &&
  typeof (value as RawDefaultValue).raw === 'string';

export const formatLiteral = (value: unknown, dialect: DialectName): string => {
  if (isRawDefault(value)) return value.raw;
  if (value === null) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') {
    if (dialect === 'mysql' || dialect === 'sqlite' || dialect === 'mssql') {
      return value ? '1' : '0';
    }
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) return `'${escapeLiteral(value.toISOString())}'`;
  if (typeof value === 'string') return `'${escapeLiteral(value)}'`;
  return `'${escapeLiteral(JSON.stringify(value))}'`;
};

export const quoteQualified = (quoter: Quoter, identifier: string): string => {
  const parts = identifier.split('.');
  return parts.map(p => quoter.quoteIdentifier(p)).join('.');
};

export const renderIndexColumns = (
  quoter: Quoter,
  columns: (string | IndexColumn)[]
): string => {
  return columns
    .map(col => {
      if (typeof col === 'string') return quoter.quoteIdentifier(col);
      const parts = [quoter.quoteIdentifier(col.column)];
      if (col.order) parts.push(col.order);
      if (col.nulls) parts.push(`NULLS ${col.nulls}`);
      return parts.join(' ');
    })
    .join(', ');
};

export const resolvePrimaryKey = (table: TableDef): string[] => {
  if (table.primaryKey && table.primaryKey.length > 0) {
    return table.primaryKey;
  }
  const cols = Object.values(table.columns);
  return cols.filter(c => c.primary).map(c => c.name);
};
