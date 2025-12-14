import type { TableDef, IndexDef } from '../../schema/table.js';
import type { ColumnDef, ForeignKeyReference } from '../../schema/column.js';
import type { DatabaseTable, DatabaseColumn, ColumnDiff } from './schema-types.js';

export type DialectName =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | (string & {});

export interface SchemaDialect {
  readonly name: DialectName;

  // Minimal quoting surface; reusable for helpers
  quoteIdentifier(id: string): string;

  // Table naming
  formatTableName(table: TableDef | DatabaseTable): string;

  // Column rendering
  renderColumnType(column: ColumnDef): string;
  renderDefault(value: unknown, column: ColumnDef): string;
  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined;

  // Constraints & indexes
  renderReference(ref: ForeignKeyReference, table: TableDef): string;
  renderIndex(table: TableDef, index: IndexDef): string;
  renderTableOptions(table: TableDef): string | undefined;

  // Capability flags
  supportsPartialIndexes(): boolean;
  preferInlinePkAutoincrement(column: ColumnDef, table: TableDef, pk: string[]): boolean;

  // DDL operations
  dropColumnSql?(table: DatabaseTable, column: string): string[];
  dropIndexSql?(table: DatabaseTable, index: string): string[];
  dropTableSql?(table: DatabaseTable): string[];
  warnDropColumn?(table: DatabaseTable, column: string): string | undefined;
  alterColumnSql?(table: TableDef, column: ColumnDef, actualColumn: DatabaseColumn, diff: ColumnDiff): string[];
  warnAlterColumn?(table: TableDef, column: ColumnDef, actualColumn: DatabaseColumn, diff: ColumnDiff): string | undefined;
}
