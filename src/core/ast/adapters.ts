import { ColumnDef } from '../../schema/column.js';
import { TableDef } from '../../schema/table.js';
import { ColumnRef, TableRef } from './types.js';

/**
 * Type guard to check if an object has an alias property
 */
const hasAlias = (obj: unknown): obj is { alias?: string } =>
  typeof obj === 'object' && obj !== null && 'alias' in obj;

/**
 * Adapts a schema ColumnDef to an AST-friendly ColumnRef.
 */
export const toColumnRef = (col: ColumnRef | ColumnDef): ColumnRef => ({
  name: col.name,
  table: col.table,
  alias: hasAlias(col) ? col.alias : undefined
});

/**
 * Adapts a schema TableDef to an AST-friendly TableRef.
 */
export const toTableRef = (table: TableRef | TableDef): TableRef => ({
  name: table.name,
  schema: table.schema,
  alias: hasAlias(table) ? table.alias : undefined
});
