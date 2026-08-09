import type { TableDef, IndexDef } from '../../schema/table.js';
import type { ColumnDef, ForeignKeyReference } from '../../schema/column-types.js';
import type { DatabaseTable } from './schema-types.js';
import type {
  DialectName,
  SchemaDialect,
  SchemaMutationCapabilities
} from './schema-dialect.js';
import {
  formatLiteral,
  quoteQualified,
  type LiteralFormatter
} from './sql-writing.js';

export interface SchemaDialectServices {
  readonly name: DialectName;
  quoteIdentifier(id: string): string;
  formatTableName(table: TableDef | DatabaseTable): string;
  renderDefault(value: unknown, column: ColumnDef): string;
}

export interface SchemaDialectConfig {
  name: DialectName;
  quoteIdentifier(id: string): string;
  literalFormatter: LiteralFormatter;

  renderColumnType(column: ColumnDef, services: SchemaDialectServices): string;
  renderAutoIncrement(
    column: ColumnDef,
    table: TableDef,
    services: SchemaDialectServices
  ): string | undefined;
  renderIndex(
    table: TableDef,
    index: IndexDef,
    services: SchemaDialectServices
  ): string;

  renderDefault?(
    value: unknown,
    column: ColumnDef,
    services: SchemaDialectServices
  ): string;
  renderReferenceSuffix?(
    ref: ForeignKeyReference,
    table: TableDef,
    services: SchemaDialectServices
  ): string | undefined;
  renderTableOptions?(
    table: TableDef,
    services: SchemaDialectServices
  ): string | undefined;
  supportsPartialIndexes?: boolean;
  preferInlinePkAutoincrement?(
    column: ColumnDef,
    table: TableDef,
    pk: string[],
    services: SchemaDialectServices
  ): boolean;
  mutations?: (services: SchemaDialectServices) => SchemaMutationCapabilities;
}

/**
 * Assembles a complete schema dialect from independent rendering functions and
 * mutation capabilities. No inheritance participates in the DDL path.
 */
export const composeSchemaDialect = (config: SchemaDialectConfig): SchemaDialect => {
  const quoteIdentifier = (id: string): string => config.quoteIdentifier(id);
  const formatTableName = (table: TableDef | DatabaseTable): string =>
    table.schema
      ? `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`
      : quoteIdentifier(table.name);

  let services!: SchemaDialectServices;
  const renderDefault = (value: unknown, column: ColumnDef): string =>
    config.renderDefault?.(value, column, services)
      ?? formatLiteral(config.literalFormatter, value);

  services = {
    name: config.name,
    quoteIdentifier,
    formatTableName,
    renderDefault
  };

  const mutations = config.mutations?.(services) ?? {};

  return {
    name: config.name,
    mutations,
    quoteIdentifier,
    formatTableName,
    renderColumnType: column => config.renderColumnType(column, services),
    renderDefault,
    renderAutoIncrement: (column, table) =>
      config.renderAutoIncrement(column, table, services),
    renderReference(ref, table) {
      const parts = [
        'REFERENCES',
        quoteQualified({ quoteIdentifier }, ref.table),
        `(${quoteIdentifier(ref.column)})`
      ];
      if (ref.onDelete) parts.push('ON DELETE', ref.onDelete);
      if (ref.onUpdate) parts.push('ON UPDATE', ref.onUpdate);
      const suffix = config.renderReferenceSuffix?.(ref, table, services);
      if (suffix) parts.push(suffix);
      return parts.join(' ');
    },
    renderIndex: (table, index) => config.renderIndex(table, index, services),
    renderTableOptions: table => config.renderTableOptions?.(table, services),
    supportsPartialIndexes: () => config.supportsPartialIndexes ?? false,
    preferInlinePkAutoincrement: (column, table, pk) =>
      config.preferInlinePkAutoincrement?.(column, table, pk, services) ?? false
  };
};

export const createStandardDropTableCapability = (
  services: SchemaDialectServices
): NonNullable<SchemaMutationCapabilities['dropTable']> => ({
  compile: table => [`DROP TABLE IF EXISTS ${services.formatTableName(table)};`]
});

export const createStandardDropColumnCapability = (
  services: SchemaDialectServices
): NonNullable<SchemaMutationCapabilities['dropColumn']> => ({
  compile: (table, column) => [
    `ALTER TABLE ${services.formatTableName(table)} DROP COLUMN ${services.quoteIdentifier(column)};`
  ]
});
