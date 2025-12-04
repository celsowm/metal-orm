import { SchemaDialect, DialectName, formatLiteral, quoteQualified } from '../schema-generator.js';
import { ColumnDef, ForeignKeyReference } from '../../../schema/column.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { DatabaseTable } from '../schema-types.js';

type TableLike = { name: string; schema?: string };

/**
 * Common behavior for schema dialects (DDL).
 * Concrete dialects only override the small surface area instead of reimplementing everything.
 */
export abstract class BaseSchemaDialect implements SchemaDialect {
  abstract name: DialectName;
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
  renderDefault(value: unknown, _column: ColumnDef): string {
    return formatLiteral(value, this.name);
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
  abstract dropColumnSql(table: DatabaseTable, column: string): string[];
  abstract dropIndexSql(table: DatabaseTable, index: string): string[];
  warnDropColumn(_table: DatabaseTable, _column: string): string | undefined {
    return undefined;
  }
}
