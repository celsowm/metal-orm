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

/** Interface for schema dialect implementations that handle database-specific DDL operations. */
export interface SchemaDialect {
  /** The name of the dialect. */
  readonly name: DialectName;

  /** Quotes an identifier for use in SQL. */
  quoteIdentifier(id: string): string;

  /** Formats the table name for SQL. */
  formatTableName(table: TableDef | DatabaseTable): string;

  /** Renders the column type for SQL. */
  renderColumnType(column: ColumnDef): string;
  /** Renders the default value for SQL. */
  renderDefault(value: unknown, column: ColumnDef): string;
  /** Renders the auto-increment clause for SQL. */
  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined;

  /** Renders a foreign key reference for SQL. */
  renderReference(ref: ForeignKeyReference, table: TableDef): string;
  /** Renders an index for SQL. */
  renderIndex(table: TableDef, index: IndexDef): string;
  /** Renders table options for SQL. */
  renderTableOptions(table: TableDef): string | undefined;

  /** Checks if the dialect supports partial indexes. */
  supportsPartialIndexes(): boolean;
  /** Checks if the dialect prefers inline primary key auto-increment. */
  preferInlinePkAutoincrement(column: ColumnDef, table: TableDef, pk: string[]): boolean;

  /** Generates SQL to drop a column. */
  dropColumnSql?(table: DatabaseTable, column: string): string[];
  /** Generates SQL to drop an index. */
  dropIndexSql?(table: DatabaseTable, index: string): string[];
  /** Generates SQL to drop a table. */
  dropTableSql?(table: DatabaseTable): string[];
  /** Returns a warning message for dropping a column. */
  warnDropColumn?(table: DatabaseTable, column: string): string | undefined;
  /** Generates SQL to alter a column. */
  alterColumnSql?(table: TableDef, column: ColumnDef, actualColumn: DatabaseColumn, diff: ColumnDiff): string[];
  /** Returns a warning message for altering a column. */
  warnAlterColumn?(table: TableDef, column: ColumnDef, actualColumn: DatabaseColumn, diff: ColumnDiff): string | undefined;
}

