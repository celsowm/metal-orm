import { ForeignKeyReference } from '../../schema/column.js';
import { IndexColumn } from '../../schema/table.js';

/** Represents the differences detected in a database column's properties. */
export interface ColumnDiff {
  typeChanged?: boolean;
  nullabilityChanged?: boolean;
  defaultChanged?: boolean;
  autoIncrementChanged?: boolean;
}

/** Represents a column in the database schema. */
export interface DatabaseColumn {
  name: string;
  type: string;
  notNull?: boolean;
  default?: unknown;
  autoIncrement?: boolean;
  generated?: 'always' | 'byDefault';
  unique?: boolean | string;
  references?: ForeignKeyReference;
  check?: string;
}

/** Represents an index in the database schema. */
export interface DatabaseIndex {
  name: string;
  columns: IndexColumn[];
  unique?: boolean;
  where?: string;
}

/** Represents a check constraint in the database schema. */
export interface DatabaseCheck {
  name?: string;
  expression: string;
}

/** Represents a table in the database schema. */
export interface DatabaseTable {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  primaryKey?: string[];
  indexes?: DatabaseIndex[];
  checks?: DatabaseCheck[];
}

/** Represents the overall database schema. */
export interface DatabaseSchema {
  tables: DatabaseTable[];
}
