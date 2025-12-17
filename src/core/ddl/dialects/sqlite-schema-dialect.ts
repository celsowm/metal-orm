import { BaseSchemaDialect } from './base-schema-dialect.js';
import { deriveIndexName } from '../naming-strategy.js';
import { renderIndexColumns, resolvePrimaryKey, createLiteralFormatter } from '../sql-writing.js';
import { ColumnDef, normalizeColumnType, renderTypeWithArgs } from '../../../schema/column-types.js';
import { IndexDef, TableDef } from '../../../schema/table.js';
import { ColumnDiff, DatabaseColumn, DatabaseTable } from '../schema-types.js';
import { DialectName } from '../schema-dialect.js';

/** SQLite schema dialect implementation. */
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
    const override = column.dialectTypes?.[this.name] ?? column.dialectTypes?.default;
    if (override) {
      return renderTypeWithArgs(override, column.args);
    }

    const type = normalizeColumnType(column.type);
    switch (type) {
      case 'int':
      case 'integer':
      case 'bigint':
        return 'INTEGER';
      case 'boolean':
        return 'INTEGER';
      case 'decimal':
      case 'float':
      case 'double':
        return 'REAL';
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'timestamptz':
        return 'TEXT';
      case 'varchar':
      case 'text':
      case 'json':
      case 'uuid':
      case 'enum':
        return 'TEXT';
      case 'binary':
      case 'varbinary':
      case 'blob':
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

