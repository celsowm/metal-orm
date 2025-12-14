import { SchemaDialect, DialectName } from '../schema-dialect.js';
import { formatLiteral, quoteQualified, LiteralFormatter } from '../sql-writing.js';
import { ColumnDef, ForeignKeyReference } from '../../../schema/column.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { DatabaseTable, DatabaseColumn, ColumnDiff } from '../schema-types.js';

type TableLike = { name: string; schema?: string };

/**
 * Common behavior for schema dialects (DDL).
 * Concrete dialects only override the small surface area instead of reimplementing everything.
 */
export abstract class BaseSchemaDialect implements SchemaDialect {
  abstract readonly name: DialectName;
  abstract quoteIdentifier(id: string): string;
  abstract renderColumnType(column: ColumnDef): string;
  abstract renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined;
  abstract renderIndex(table: TableDef, index: IndexDef): string;
  supportsPartialIndexes(): boolean {
    return false;
  }
  formatTableName(table: TableLike): string {
    if (table.schema) {
      return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
    }
    return this.quoteIdentifier(table.name);
  }
  // Each dialect should provide its own formatter
  abstract get literalFormatter(): LiteralFormatter;

  renderDefault(value: unknown, _column: ColumnDef): string {
    return formatLiteral(this.literalFormatter, value);
  }
  renderReference(ref: ForeignKeyReference, _table: TableDef): string {
    const parts = ['REFERENCES', quoteQualified(this, ref.table), `(${this.quoteIdentifier(ref.column)})`];
    if (ref.onDelete) parts.push('ON DELETE', ref.onDelete);
    if (ref.onUpdate) parts.push('ON UPDATE', ref.onUpdate);
    if (ref.deferrable && this.name === 'postgres') parts.push('DEFERRABLE INITIALLY DEFERRED');
    return parts.join(' ');
  }
  renderTableOptions(_table: TableDef): string | undefined {
    return undefined;
  }
  dropTableSql(table: DatabaseTable): string[] {
    return [`DROP TABLE IF EXISTS ${this.formatTableName(table)};`];
  }
  dropColumnSql(table: DatabaseTable, column: string): string[] {
    return [`ALTER TABLE ${this.formatTableName(table)} DROP COLUMN ${this.quoteIdentifier(column)};`];
  }
  dropIndexSql(table: DatabaseTable, index: string): string[] {
    return [`DROP INDEX ${this.quoteIdentifier(index)};`];
  }
  warnDropColumn(_table: DatabaseTable, _column: string): string | undefined {
    return undefined;
  }
  alterColumnSql?(_table: TableDef, _column: ColumnDef, _actualColumn: DatabaseColumn, _diff: ColumnDiff): string[] {
    return [];
  }
  warnAlterColumn?(_table: TableDef, _column: ColumnDef, _actual: DatabaseColumn, _diff: ColumnDiff): string | undefined {
    return undefined;
  }
}
