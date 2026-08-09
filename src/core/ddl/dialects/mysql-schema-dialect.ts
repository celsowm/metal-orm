import { deriveIndexName } from '../naming-strategy.js';
import {
  createLiteralFormatter,
  escapeSqlString,
  renderIndexColumns
} from '../sql-writing.js';
import {
  composeSchemaDialect,
  createStandardDropColumnCapability,
  createStandardDropTableCapability,
  type SchemaDialectServices
} from '../schema-dialect-composer.js';
import type { SchemaDialect } from '../schema-dialect.js';
import { renderColumnDefinition } from '../schema-generator.js';
import {
  normalizeColumnType,
  renderTypeWithArgs,
  type ColumnDef
} from '../../../schema/column-types.js';
import type { IndexDef, TableDef } from '../../../schema/table.js';
import type { DatabaseTable } from '../schema-types.js';

const quoteIdentifier = (id: string): string => `\`${id}\``;
const literalFormatter = createLiteralFormatter({ booleanTrue: '1', booleanFalse: '0' });

const renderMySqlColumnType = (
  column: ColumnDef,
  services: SchemaDialectServices
): string => {
  const override = column.dialectTypes?.[services.name] ?? column.dialectTypes?.default;
  if (override) return renderTypeWithArgs(override, column.args);

  const type = normalizeColumnType(column.type);
  switch (type) {
    case 'int':
    case 'integer': return 'INT';
    case 'bigint': return 'BIGINT';
    case 'uuid': return 'CHAR(36)';
    case 'boolean': return 'TINYINT(1)';
    case 'json': return 'JSON';
    case 'decimal':
      return column.args?.length ? `DECIMAL(${column.args[0]},${column.args[1] ?? 0})` : 'DECIMAL';
    case 'float': return column.args?.length ? `FLOAT(${column.args[0]})` : 'FLOAT';
    case 'double': return 'DOUBLE';
    case 'timestamptz':
    case 'timestamp': return 'TIMESTAMP';
    case 'datetime': return 'DATETIME';
    case 'date': return 'DATE';
    case 'varchar': return column.args?.length ? `VARCHAR(${column.args[0]})` : 'VARCHAR(255)';
    case 'text': return 'TEXT';
    case 'binary': return column.args?.length ? `BINARY(${column.args[0]})` : 'BINARY(255)';
    case 'varbinary': return column.args?.length ? `VARBINARY(${column.args[0]})` : 'VARBINARY(255)';
    case 'blob':
    case 'bytea': return 'BLOB';
    case 'enum':
      return column.args?.length
        ? `ENUM(${column.args.map(value => `'${escapeSqlString(String(value))}'`).join(',')})`
        : 'ENUM';
    case 'vector':
    case 'halfvec': {
      const dimensions = column.vectorOptions?.dimensions ?? column.args?.[0] ?? 3;
      return `VECTOR(${dimensions})`;
    }
    default: return renderTypeWithArgs(String(type).toUpperCase(), column.args);
  }
};

export const createMySqlSchemaDialect = (): SchemaDialect => {
  let dialect!: SchemaDialect;
  dialect = composeSchemaDialect({
    name: 'mysql',
    quoteIdentifier,
    literalFormatter,
    renderColumnType: renderMySqlColumnType,
    renderAutoIncrement: column => column.autoIncrement ? 'AUTO_INCREMENT' : undefined,
    renderIndex(table, index, services) {
      if (index.where) throw new Error('MySQL does not support partial/filtered indexes');
      const name = index.name || deriveIndexName(table, index);
      const columns = renderIndexColumns(services, index.columns);
      const unique = index.unique ? 'UNIQUE ' : '';
      return `CREATE ${unique}INDEX ${services.quoteIdentifier(name)} ON ${services.formatTableName(table)} (${columns});`;
    },
    renderTableOptions(table) {
      const parts: string[] = [];
      if (table.engine) parts.push(`ENGINE=${table.engine}`);
      if (table.charset) parts.push(`DEFAULT CHARSET=${table.charset}`);
      if (table.collation) parts.push(`COLLATE=${table.collation}`);
      return parts.length ? parts.join(' ') : undefined;
    },
    mutations: services => ({
      dropTable: createStandardDropTableCapability(services),
      dropColumn: createStandardDropColumnCapability(services),
      dropIndex: {
        compile: (table, index) => [
          `DROP INDEX ${services.quoteIdentifier(index)} ON ${services.formatTableName(table)};`
        ]
      },
      alterColumn: {
        compile(table, column, actualColumn, diff) {
          void actualColumn;
          void diff;
          const rendered = renderColumnDefinition(table, column, dialect);
          return [`ALTER TABLE ${services.formatTableName(table)} MODIFY COLUMN ${rendered.sql};`];
        }
      }
    })
  });
  return dialect;
};

/** Ergonomic facade; DDL rendering itself is pure composition. */
export class MySqlSchemaDialect implements SchemaDialect {
  private readonly delegate = createMySqlSchemaDialect();
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
