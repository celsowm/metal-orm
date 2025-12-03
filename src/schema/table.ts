import { ColumnDef } from './column';
import { RelationDef } from './relation';

/**
 * Definition of a database table with its columns and relationships
 * @typeParam T - Type of the columns record
 */
export interface TableDef<T extends Record<string, ColumnDef> = Record<string, ColumnDef>> {
  /** Name of the table */
  name: string;
  /** Record of column definitions keyed by column name */
  columns: T;
  /** Record of relationship definitions keyed by relation name */
  relations: Record<string, RelationDef>;
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
    relations: Record<string, RelationDef> = {}
): TableDef<T> => {
  // Runtime mutability to assign names to column definitions for convenience
  const colsWithNames = Object.entries(columns).reduce((acc, [key, def]) => {
    (acc as any)[key] = { ...def, name: key, table: name };
    return acc;
  }, {} as T);

  return { name, columns: colsWithNames, relations };
};
