import { deriveIndexName } from '../naming-strategy.js';
import {
  createLiteralFormatter,
  renderIndexColumns
} from '../sql-writing.js';
import {
  composeSchemaDialect,
  createStandardDropColumnCapability,
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

const quoteIdentifier = (id: string): string => `[${id.replace(/]/g, ']]')}]`;
const literalFormatter = createLiteralFormatter({ booleanTrue: '1', booleanFalse: '0' });

const renderMssqlColumnType = (
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
    case 'uuid': return 'UNIQUEIDENTIFIER';
    case 'boolean': return 'BIT';
    case 'json': return 'NVARCHAR(MAX)';
    case 'decimal':
      return column.args?.length ? `DECIMAL(${column.args[0]},${column.args[1] ?? 0})` : 'DECIMAL(18,0)';
    case 'float':
    case 'double': return 'FLOAT';
    case 'timestamptz':
    case 'timestamp':
    case 'datetime': return 'DATETIME2';
    case 'date': return 'DATE';
    case 'varchar': return column.args?.length ? `NVARCHAR(${column.args[0]})` : 'NVARCHAR(255)';
    case 'text': return 'NVARCHAR(MAX)';
    case 'binary': {
      const length = column.args?.[0];
      return length !== undefined ? `BINARY(${length})` : 'BINARY(255)';
    }
    case 'varbinary': {
      const length = column.args?.[0];
      if (typeof length === 'string' && length.toLowerCase() === 'max') return 'VARBINARY(MAX)';
      return length !== undefined ? `VARBINARY(${length})` : 'VARBINARY(255)';
    }
    case 'blob':
    case 'bytea': return 'VARBINARY(MAX)';
    case 'enum': return 'NVARCHAR(255)';
    case 'vector': {
      const dimensions = column.vectorOptions?.dimensions ?? column.args?.[0] ?? 3;
      const elementType = column.vectorOptions?.elementType;
      return elementType ? `VECTOR(${dimensions}, ${elementType})` : `VECTOR(${dimensions})`;
    }
    case 'halfvec': {
      const dimensions = column.vectorOptions?.dimensions ?? column.args?.[0] ?? 3;
      return `VECTOR(${dimensions}, float16)`;
    }
    default: return renderTypeWithArgs(String(type).toUpperCase(), column.args);
  }
};

export const createMssqlSchemaDialect = (): SchemaDialect =>
  composeSchemaDialect({
    name: 'mssql',
    quoteIdentifier,
    literalFormatter,
    renderColumnType: renderMssqlColumnType,
    renderAutoIncrement: column => column.autoIncrement ? 'IDENTITY(1,1)' : undefined,
    renderIndex(table, index, services) {
      const name = index.name || deriveIndexName(table, index);
      const columns = renderIndexColumns(services, index.columns);
      const unique = index.unique ? 'UNIQUE ' : '';
      const where = index.where ? ` WHERE ${index.where}` : '';
      return `CREATE ${unique}INDEX ${services.quoteIdentifier(name)} ON ${services.formatTableName(table)} (${columns})${where};`;
    },
    supportsPartialIndexes: true,
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
          const statements: string[] = [];
          if (diff.typeChanged || diff.nullabilityChanged) {
            const nullability = column.notNull ? 'NOT NULL' : 'NULL';
            statements.push(
              `ALTER TABLE ${services.formatTableName(table)} ALTER COLUMN ${services.quoteIdentifier(column.name)} ${renderMssqlColumnType(column, services)} ${nullability};`
            );
          }
          return statements;
        },
        warning(table, column, actualColumn, diff) {
          void table;
          void column;
          void actualColumn;
          return diff.defaultChanged || diff.autoIncrementChanged
            ? 'Altering defaults or identity on MSSQL is not automated (requires dropping/adding default or identity constraints manually).'
            : undefined;
        }
      }
    })
  });

/** Ergonomic facade; DDL rendering itself is pure composition. */
export class MSSqlSchemaDialect implements SchemaDialect {
  private readonly delegate = createMssqlSchemaDialect();
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
