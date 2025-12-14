import { BaseSchemaDialect } from './base-schema-dialect.js';
import { deriveIndexName } from '../naming-strategy.js';
import { renderIndexColumns, resolvePrimaryKey, createLiteralFormatter } from '../sql-writing.js';
import { ColumnDef } from '../../../schema/column.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { ColumnDiff, DatabaseColumn, DatabaseTable } from '../schema-types.js';
import { DialectName } from '../schema-dialect.js';

export class SQLiteSchemaDialect extends BaseSchemaDialect {
  name: DialectName = 'sqlite';

  private _literalFormatter = createLiteralFormatter({
    booleanTrue: '1',
    booleanFalse: '0',
  });

  get literalFormatter() {
    return this._literalFormatter;
  }

  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  renderColumnType(column: ColumnDef): string {
    switch (column.type) {
      case 'INT':
      case 'INTEGER':
      case 'int':
      case 'integer':
      case 'BIGINT':
      case 'bigint':
        return 'INTEGER';
      case 'BOOLEAN':
      case 'boolean':
        return 'INTEGER';
      case 'DECIMAL':
      case 'decimal':
      case 'FLOAT':
      case 'float':
      case 'DOUBLE':
      case 'double':
        return 'REAL';
      case 'DATE':
      case 'date':
      case 'DATETIME':
      case 'datetime':
      case 'TIMESTAMP':
      case 'timestamp':
      case 'TIMESTAMPTZ':
      case 'timestamptz':
        return 'TEXT';
      case 'VARCHAR':
      case 'varchar':
      case 'TEXT':
      case 'text':
      case 'JSON':
      case 'json':
      case 'UUID':
      case 'uuid':
        return 'TEXT';
      case 'ENUM':
      case 'enum':
        return 'TEXT';
      case 'BINARY':
      case 'binary':
      case 'VARBINARY':
      case 'varbinary':
      case 'BLOB':
      case 'blob':
      case 'BYTEA':
      case 'bytea':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }

  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined {
    const pk = resolvePrimaryKey(table);
    if (column.autoIncrement && pk.length === 1 && pk[0] === column.name) {
      return 'PRIMARY KEY AUTOINCREMENT';
    }
    return undefined;
  }

  preferInlinePkAutoincrement(column: ColumnDef, table: TableDef, pk: string[]): boolean {
    return !!(column.autoIncrement && pk.length === 1 && pk[0] === column.name);
  }

  renderDefault(value: unknown): string {
    return this.literalFormatter.formatLiteral(value);
  }

  renderIndex(table: TableDef, index: IndexDef): string {
    if (index.where) {
      throw new Error('SQLite does not support partial/filtered indexes');
    }
    const name = index.name || deriveIndexName(table, index);
    const cols = renderIndexColumns(this, index.columns);
    const unique = index.unique ? 'UNIQUE ' : '';
    return `CREATE ${unique}INDEX IF NOT EXISTS ${this.quoteIdentifier(name)} ON ${this.formatTableName(table)} (${cols});`;
  }

  dropColumnSql(_table: DatabaseTable, _column: string): string[] {
    void _table;
    void _column;
    return [];
  }

  dropIndexSql(_table: DatabaseTable, index: string): string[] {
    void _table;
    return [`DROP INDEX IF EXISTS ${this.quoteIdentifier(index)};`];
  }

  warnDropColumn(table: DatabaseTable, column: string): string | undefined {
    const key = table.schema ? `${table.schema}.${table.name}` : table.name;
    return `Dropping columns on SQLite requires table rebuild (column ${column} on ${key}).`;
  }

  alterColumnSql(_table: TableDef, _column: ColumnDef, _actual: DatabaseColumn, _diff: ColumnDiff): string[] {
    void _table;
    void _column;
    void _actual;
    void _diff;
    return [];
  }

  warnAlterColumn(table: TableDef, column: ColumnDef, _actual: DatabaseColumn, _diff: ColumnDiff): string | undefined {
    void _actual;
    void _diff;
    const key = table.schema ? `${table.schema}.${table.name}` : table.name;
    return `SQLite ALTER COLUMN is not supported; rebuild table ${key} to change column ${column.name}.`;
  }
}
