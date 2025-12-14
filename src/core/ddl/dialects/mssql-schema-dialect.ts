import { BaseSchemaDialect } from './base-schema-dialect.js';
import { deriveIndexName } from '../naming-strategy.js';
import { renderIndexColumns, createLiteralFormatter } from '../sql-writing.js';
import { ColumnDef } from '../../../schema/column.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { ColumnDiff, DatabaseColumn, DatabaseTable } from '../schema-types.js';
import { DialectName } from '../schema-dialect.js';

/** MSSQL schema dialect implementation. */
export class MSSqlSchemaDialect extends BaseSchemaDialect {
  name: DialectName = 'mssql';

  private _literalFormatter = createLiteralFormatter({
    booleanTrue: '1',
    booleanFalse: '0',
  });

  get literalFormatter() {
    return this._literalFormatter;
  }

  quoteIdentifier(id: string): string {
    return `[${id.replace(/]/g, ']]')}]`;
  }

  renderColumnType(column: ColumnDef): string {
    switch (column.type) {
      case 'INT':
      case 'INTEGER':
      case 'int':
      case 'integer':
        return 'INT';
      case 'BIGINT':
      case 'bigint':
        return 'BIGINT';
      case 'UUID':
      case 'uuid':
        return 'UNIQUEIDENTIFIER';
      case 'BOOLEAN':
      case 'boolean':
        return 'BIT';
      case 'JSON':
      case 'json':
        return 'NVARCHAR(MAX)';
      case 'DECIMAL':
      case 'decimal':
        return column.args?.length ? `DECIMAL(${column.args[0]},${column.args[1] ?? 0})` : 'DECIMAL(18,0)';
      case 'FLOAT':
      case 'float':
      case 'DOUBLE':
      case 'double':
        return 'FLOAT';
      case 'TIMESTAMPTZ':
      case 'timestamptz':
      case 'TIMESTAMP':
      case 'timestamp':
      case 'DATETIME':
      case 'datetime':
        return 'DATETIME2';
      case 'DATE':
      case 'date':
        return 'DATE';
      case 'VARCHAR':
      case 'varchar':
        return column.args?.length ? `NVARCHAR(${column.args[0]})` : 'NVARCHAR(255)';
      case 'TEXT':
      case 'text':
        return 'NVARCHAR(MAX)';
      case 'BINARY':
      case 'binary': {
        const length = column.args?.[0];
        return length !== undefined ? `BINARY(${length})` : 'BINARY(255)';
      }
      case 'VARBINARY':
      case 'varbinary': {
        const length = column.args?.[0];
        if (typeof length === 'string' && length.toLowerCase() === 'max') {
          return 'VARBINARY(MAX)';
        }
        return length !== undefined ? `VARBINARY(${length})` : 'VARBINARY(255)';
      }
      case 'BLOB':
      case 'blob':
      case 'BYTEA':
      case 'bytea':
        return 'VARBINARY(MAX)';
      case 'ENUM':
      case 'enum':
        return 'NVARCHAR(255)';
      default:
        return String(column.type).toUpperCase();
    }
  }

  renderDefault(value: unknown): string {
    return this.literalFormatter.formatLiteral(value);
  }

  renderAutoIncrement(column: ColumnDef): string | undefined {
    return column.autoIncrement ? 'IDENTITY(1,1)' : undefined;
  }

  renderIndex(table: TableDef, index: IndexDef): string {
    const name = index.name || deriveIndexName(table, index);
    const cols = renderIndexColumns(this, index.columns);
    const unique = index.unique ? 'UNIQUE ' : '';
    const where = index.where ? ` WHERE ${index.where}` : '';
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(name)} ON ${this.formatTableName(table)} (${cols})${where};`;
  }

  supportsPartialIndexes(): boolean {
    return true;
  }

  dropColumnSql(table: DatabaseTable, column: string): string[] {
    return [`ALTER TABLE ${this.formatTableName(table)} DROP COLUMN ${this.quoteIdentifier(column)};`];
  }

  dropIndexSql(table: DatabaseTable, index: string): string[] {
    return [`DROP INDEX ${this.quoteIdentifier(index)} ON ${this.formatTableName(table)};`];
  }

  alterColumnSql(table: TableDef, column: ColumnDef, _actual: DatabaseColumn, diff: ColumnDiff): string[] {
    void _actual;
    const stmts: string[] = [];
    if (diff.typeChanged || diff.nullabilityChanged) {
      const nullability = column.notNull ? 'NOT NULL' : 'NULL';
      stmts.push(
        `ALTER TABLE ${this.formatTableName(table)} ALTER COLUMN ${this.quoteIdentifier(column.name)} ${this.renderColumnType(column)} ${nullability};`
      );
    }
    return stmts;
  }

  warnAlterColumn(_table: TableDef, _column: ColumnDef, _actual: DatabaseColumn, diff: ColumnDiff): string | undefined {
    void _table;
    void _column;
    void _actual;
    if (diff.defaultChanged || diff.autoIncrementChanged) {
      return 'Altering defaults or identity on MSSQL is not automated (requires dropping/adding default or identity constraints manually).';
    }
    return undefined;
  }
}
