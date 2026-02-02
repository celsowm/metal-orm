import { ForeignKeyReference } from '../../schema/column-types.js';
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
  comment?: string;
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
  comment?: string;
}

/** Represents a view in the database schema. */
export interface DatabaseView {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  definition?: string;
  comment?: string;
}

/** Represents the overall database schema. */
export interface DatabaseSchema {
  tables: DatabaseTable[];
  views?: DatabaseView[];
}
