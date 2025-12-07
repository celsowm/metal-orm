import { ForeignKeyReference } from '../../schema/column.js';
import { IndexColumn } from '../../schema/table.js';

export interface ColumnDiff {
  typeChanged?: boolean;
  nullabilityChanged?: boolean;
  defaultChanged?: boolean;
  autoIncrementChanged?: boolean;
}

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

export interface DatabaseIndex {
  name: string;
  columns: IndexColumn[];
  unique?: boolean;
  where?: string;
}

export interface DatabaseCheck {
  name?: string;
  expression: string;
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  primaryKey?: string[];
  indexes?: DatabaseIndex[];
  checks?: DatabaseCheck[];
  foreignKeys?: ForeignKey[];
}

export interface ForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
}
