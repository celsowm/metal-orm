/**
 * Minimal column reference used by AST builders.
 * Accepts any object with a name and optional table/alias fields
 * (schema ColumnDef/TableDef remain structurally compatible).
 */
export interface ColumnRef {
  name: string;
  table?: string;
  alias?: string;
}

/**
 * Minimal table reference used by AST builders.
 * Keeps AST decoupled from full schema TableDef shape.
 */
export interface TableRef {
  name: string;
  schema?: string;
  alias?: string;
}
