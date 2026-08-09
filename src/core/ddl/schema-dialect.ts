import type { TableDef, IndexDef } from '../../schema/table.js';
import type { ColumnDef, ForeignKeyReference } from '../../schema/column-types.js';
import type { DatabaseTable, DatabaseColumn, ColumnDiff } from './schema-types.js';

/** The name of a database dialect. */
export type DialectName =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | (string & {});

export interface DropTableCapability {
  compile(table: DatabaseTable): string[];
  warning?(table: DatabaseTable): string | undefined;
}

export interface DropColumnCapability {
  compile(table: DatabaseTable, column: string): string[];
  warning?(table: DatabaseTable, column: string): string | undefined;
}

export interface DropIndexCapability {
  compile(table: DatabaseTable, index: string): string[];
  warning?(table: DatabaseTable, index: string): string | undefined;
}

export interface AlterColumnCapability {
  compile(
    table: TableDef,
    column: ColumnDef,
    actualColumn: DatabaseColumn,
    diff: ColumnDiff
  ): string[];
  warning?(
    table: TableDef,
    column: ColumnDef,
    actualColumn: DatabaseColumn,
    diff: ColumnDiff
  ): string | undefined;
}

/** Explicit DDL mutation capabilities supported by a schema dialect. */
export interface SchemaMutationCapabilities {
  dropTable?: DropTableCapability;
  dropColumn?: DropColumnCapability;
  dropIndex?: DropIndexCapability;
  alterColumn?: AlterColumnCapability;
}

/** Structural contract for database-specific DDL rendering. */
export interface SchemaDialect {
  readonly name: DialectName;
  readonly mutations: SchemaMutationCapabilities;

  quoteIdentifier(id: string): string;
  formatTableName(table: TableDef | DatabaseTable): string;

  renderColumnType(column: ColumnDef): string;
  renderDefault(value: unknown, column: ColumnDef): string;
  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined;

  renderReference(ref: ForeignKeyReference, table: TableDef): string;
  renderIndex(table: TableDef, index: IndexDef): string;
  renderTableOptions(table: TableDef): string | undefined;

  supportsPartialIndexes(): boolean;
  preferInlinePkAutoincrement(column: ColumnDef, table: TableDef, pk: string[]): boolean;
}
