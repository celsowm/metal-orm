import { deriveIndexName } from '../naming-strategy.js';
import {
  createLiteralFormatter,
  renderIndexColumns,
  resolvePrimaryKey
} from '../sql-writing.js';
import {
  composeSchemaDialect,
  createStandardDropTableCapability,
  type SchemaDialectServices
} from '../schema-dialect-composer.js';
import type { SchemaDialect } from '../schema-dialect.js';
import {
  normalizeColumnType,
  renderTypeWithArgs,
  type ColumnDef
} from '../../../schema/column-types.js';
import type { IndexDef, TableDef } from '../../../schema/table.js';
import type { DatabaseTable } from '../schema-types.js';

const quoteIdentifier = (id: string): string => `"${id}"`;
const literalFormatter = createLiteralFormatter({ booleanTrue: '1', booleanFalse: '0' });

const renderSqliteColumnType = (
  column: ColumnDef,
  services: SchemaDialectServices
): string => {
  const override = column.dialectTypes?.[services.name] ?? column.dialectTypes?.default;
  if (override) return renderTypeWithArgs(override, column.args);

  const type = normalizeColumnType(column.type);
  switch (type) {
    case 'int':
    case 'integer':
    case 'bigint':
    case 'boolean': return 'INTEGER';
    case 'decimal':
    case 'float':
    case 'double': return 'REAL';
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
    case 'varchar':
    case 'text':
    case 'json':
    case 'uuid':
    case 'enum': return 'TEXT';
    case 'binary':
    case 'varbinary':
    case 'blob':
    case 'bytea': return 'BLOB';
    case 'halfvec': {
      const dimensions = column.vectorOptions?.dimensions ?? column.args?.[0] ?? 3;
      return `float16[${dimensions}]`;
    }
    case 'vector': {
      const dimensions = column.vectorOptions?.dimensions ?? column.args?.[0] ?? 3;
      const elementType = column.vectorOptions?.elementType === 'float16' ? 'float16' : 'float32';
      return `${elementType}[${dimensions}]`;
    }
    default: return 'TEXT';
  }
};

export const createSqliteSchemaDialect = (): SchemaDialect =>
  composeSchemaDialect({
    name: 'sqlite',
    quoteIdentifier,
    literalFormatter,
    renderColumnType: renderSqliteColumnType,
    renderAutoIncrement(column, table) {
      const primaryKey = resolvePrimaryKey(table);
      return column.autoIncrement && primaryKey.length === 1 && primaryKey[0] === column.name
        ? 'PRIMARY KEY AUTOINCREMENT'
        : undefined;
    },
    preferInlinePkAutoincrement: (column, table, primaryKey) => {
      void table;
      return !!(column.autoIncrement && primaryKey.length === 1 && primaryKey[0] === column.name);
    },
    renderIndex(table, index, services) {
      const name = index.name || deriveIndexName(table, index);
      const columns = renderIndexColumns(services, index.columns);
      const unique = index.unique ? 'UNIQUE ' : '';
      const where = index.where ? ` WHERE ${index.where}` : '';
      return `CREATE ${unique}INDEX IF NOT EXISTS ${services.quoteIdentifier(name)} ON ${services.formatTableName(table)} (${columns})${where};`;
    },
    supportsPartialIndexes: true,
    mutations: services => ({
      dropTable: createStandardDropTableCapability(services),
      dropIndex: {
        compile: (_table, index) => [`DROP INDEX IF EXISTS ${services.quoteIdentifier(index)};`]
      }
    })
  });

/** Ergonomic facade; DDL rendering itself is pure composition. */
export class SQLiteSchemaDialect implements SchemaDialect {
  private readonly delegate = createSqliteSchemaDialect();
  readonly name = this.delegate.name;
  readonly mutations = this.delegate.mutations;

  quoteIdentifier(id: string): string { return this.delegate.quoteIdentifier(id); }
  formatTableName(table: TableDef | DatabaseTable): string { return this.delegate.formatTableName(table); }
  renderColumnType(column: ColumnDef): string { return this.delegate.renderColumnType(column); }
  renderDefault(value: unknown, column: ColumnDef): string { return this.delegate.renderDefault(value, column); }
  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined {
    return this.delegate.renderAutoIncrement(column, table);
  }
  renderReference(ref: Parameters<SchemaDialect['renderReference']>[0], table: TableDef): string {
    return this.delegate.renderReference(ref, table);
  }
  renderIndex(table: TableDef, index: IndexDef): string { return this.delegate.renderIndex(table, index); }
  renderTableOptions(table: TableDef): string | undefined { return this.delegate.renderTableOptions(table); }
  supportsPartialIndexes(): boolean { return this.delegate.supportsPartialIndexes(); }
  preferInlinePkAutoincrement(column: ColumnDef, table: TableDef, pk: string[]): boolean {
    return this.delegate.preferInlinePkAutoincrement(column, table, pk);
  }
}
