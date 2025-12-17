import { BaseSchemaDialect } from './base-schema-dialect.js';
import { deriveIndexName } from '../naming-strategy.js';
import { renderIndexColumns, escapeSqlString, createLiteralFormatter } from '../sql-writing.js';
import { ColumnDef, normalizeColumnType, renderTypeWithArgs } from '../../../schema/column-types.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { ColumnDiff, DatabaseColumn, DatabaseTable } from '../schema-types.js';
import { renderColumnDefinition } from '../schema-generator.js';
import { DialectName } from '../schema-dialect.js';

/** MySQL schema dialect implementation. */
export class MySqlSchemaDialect extends BaseSchemaDialect {
  name: DialectName = 'mysql';

  private _literalFormatter = createLiteralFormatter({
    booleanTrue: '1',
    booleanFalse: '0',
  });

  get literalFormatter() {
    return this._literalFormatter;
  }

  quoteIdentifier(id: string): string {
    return `\`${id}\``;
  }

  renderColumnType(column: ColumnDef): string {
    const override = column.dialectTypes?.[this.name] ?? column.dialectTypes?.default;
    if (override) {
      return renderTypeWithArgs(override, column.args);
    }

    const type = normalizeColumnType(column.type);
    switch (type) {
      case 'int':
      case 'integer':
        return 'INT';
      case 'bigint':
        return 'BIGINT';
      case 'uuid':
        return 'CHAR(36)';
      case 'boolean':
        return 'TINYINT(1)';
      case 'json':
        return 'JSON';
      case 'decimal':
        return column.args?.length ? `DECIMAL(${column.args[0]},${column.args[1] ?? 0})` : 'DECIMAL';
      case 'float':
        return column.args?.length ? `FLOAT(${column.args[0]})` : 'FLOAT';
      case 'double':
        return 'DOUBLE';
      case 'timestamptz':
      case 'timestamp':
        return 'TIMESTAMP';
      case 'datetime':
        return 'DATETIME';
      case 'date':
        return 'DATE';
      case 'varchar':
        return column.args?.length ? `VARCHAR(${column.args[0]})` : 'VARCHAR(255)';
      case 'text':
        return 'TEXT';
      case 'binary':
        return column.args?.length ? `BINARY(${column.args[0]})` : 'BINARY(255)';
      case 'varbinary':
        return column.args?.length ? `VARBINARY(${column.args[0]})` : 'VARBINARY(255)';
      case 'blob':
      case 'bytea':
        return 'BLOB';
      case 'enum':
        return column.args && Array.isArray(column.args) && column.args.length
          ? `ENUM(${column.args.map((v: string) => `'${escapeSqlString(v)}'`).join(',')})`
          : 'ENUM';
      default:
        return renderTypeWithArgs(String(type).toUpperCase(), column.args);
    }
  }

  renderDefault(value: unknown): string {
    return this.literalFormatter.formatLiteral(value);
  }

  renderAutoIncrement(column: ColumnDef): string | undefined {
    return column.autoIncrement ? 'AUTO_INCREMENT' : undefined;
  }

  renderIndex(table: TableDef, index: IndexDef): string {
    if (index.where) {
      throw new Error('MySQL does not support partial/filtered indexes');
    }
    const name = index.name || deriveIndexName(table, index);
    const cols = renderIndexColumns(this, index.columns);
    const unique = index.unique ? 'UNIQUE ' : '';
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(name)} ON ${this.formatTableName(table)} (${cols});`;
  }

  renderTableOptions(table: TableDef): string | undefined {
    const parts: string[] = [];
    if (table.engine) parts.push(`ENGINE=${table.engine}`);
    if (table.charset) parts.push(`DEFAULT CHARSET=${table.charset}`);
    if (table.collation) parts.push(`COLLATE=${table.collation}`);
    return parts.length ? parts.join(' ') : undefined;
  }

  dropColumnSql(table: DatabaseTable, column: string): string[] {
    return [`ALTER TABLE ${this.formatTableName(table)} DROP COLUMN ${this.quoteIdentifier(column)};`];
  }

  dropIndexSql(table: DatabaseTable, index: string): string[] {
    return [`DROP INDEX ${this.quoteIdentifier(index)} ON ${this.formatTableName(table)};`];
  }

  alterColumnSql(table: TableDef, column: ColumnDef, _actual: DatabaseColumn, _diff: ColumnDiff): string[] {
    void _actual;
    void _diff;
    const rendered = renderColumnDefinition(table, column, this);
    return [`ALTER TABLE ${this.formatTableName(table)} MODIFY COLUMN ${rendered.sql};`];
  }
}

