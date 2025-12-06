import { ColumnDef } from '../../schema/column.js';
import { TableDef } from '../../schema/table.js';
import { ColumnRef, TableRef } from './types.js';

/**
 * Adapts a schema ColumnDef to an AST-friendly ColumnRef.
 */
export const toColumnRef = (col: ColumnRef | ColumnDef): ColumnRef => ({
  name: col.name,
  table: col.table,
  alias: (col as ColumnRef).alias
});

/**
 * Adapts a schema TableDef to an AST-friendly TableRef.
 */
export const toTableRef = (table: TableRef | TableDef): TableRef => ({
  name: table.name,
  schema: table.schema,
  alias: (table as TableRef).alias
});
