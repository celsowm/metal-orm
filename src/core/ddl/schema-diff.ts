import type { TableDef } from '../../schema/table.js';
import type { ColumnDef } from '../../schema/column-types.js';
import type { DbExecutor } from '../execution/db-executor.js';
import type { SchemaDialect } from './schema-dialect.js';
import { deriveIndexName } from './naming-strategy.js';
import { generateCreateTableSql, renderColumnDefinition } from './schema-generator.js';
import type { ColumnDiff, DatabaseColumn, DatabaseSchema, DatabaseTable } from './schema-types.js';

export type SchemaChangeKind =
  | 'createTable'
  | 'dropTable'
  | 'addColumn'
  | 'dropColumn'
  | 'alterColumn'
  | 'addIndex'
  | 'dropIndex';

export interface SchemaChange {
  kind: SchemaChangeKind;
  table: string;
  description: string;
  statements: string[];
  safe: boolean;
}

export interface SchemaPlan {
  changes: SchemaChange[];
  warnings: string[];
}

export interface SchemaDiffOptions {
  allowDestructive?: boolean;
}

const tableKey = (name: string, schema?: string): string => schema ? `${schema}.${name}` : name;

const mapTables = (schema: DatabaseSchema): Map<string, DatabaseTable> => {
  const map = new Map<string, DatabaseTable>();
  for (const table of schema.tables) map.set(tableKey(table.name, table.schema), table);
  return map;
};

const buildAddColumnSql = (table: TableDef, columnName: string, dialect: SchemaDialect): string => {
  const column = table.columns[columnName];
  const rendered = renderColumnDefinition(table, column, dialect);
  return `ALTER TABLE ${dialect.formatTableName(table)} ADD ${rendered.sql};`;
};

const normalizeType = (value: string | undefined): string =>
  (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const normalizeDefault = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
};

const diffColumn = (
  expected: ColumnDef,
  actual: DatabaseColumn,
  dialect: SchemaDialect
): ColumnDiff => {
  const expectedType = normalizeType(dialect.renderColumnType(expected));
  const actualType = normalizeType(actual.type);
  const expectedDefault = expected.default !== undefined
    ? normalizeDefault(dialect.renderDefault(expected.default, expected))
    : undefined;
  const actualDefault = normalizeDefault(actual.default);
  return {
    typeChanged: expectedType !== actualType,
    nullabilityChanged: !!expected.notNull !== !!actual.notNull,
    defaultChanged: expectedDefault !== actualDefault,
    autoIncrementChanged: !!expected.autoIncrement !== !!actual.autoIncrement
  };
};

const unsupportedMutationWarning = (
  dialect: SchemaDialect,
  operation: string,
  target: string
): string =>
  `Dialect "${dialect.name}" does not provide the ${operation} capability for ${target}; manual migration is required.`;

export const diffSchema = (
  expectedTables: TableDef[],
  actualSchema: DatabaseSchema,
  dialect: SchemaDialect,
  options: SchemaDiffOptions = {}
): SchemaPlan => {
  const allowDestructive = options.allowDestructive ?? false;
  const plan: SchemaPlan = { changes: [], warnings: [] };
  const actualMap = mapTables(actualSchema);

  for (const table of expectedTables) {
    const key = tableKey(table.name, table.schema);
    const actual = actualMap.get(key);
    if (!actual) {
      const { tableSql, indexSql } = generateCreateTableSql(table, dialect);
      plan.changes.push({
        kind: 'createTable',
        table: key,
        description: `Create table ${key}`,
        statements: [tableSql, ...indexSql],
        safe: true
      });
      continue;
    }

    const actualColumns = new Map(actual.columns.map(column => [column.name, column]));
    for (const columnName of Object.keys(table.columns)) {
      if (!actualColumns.has(columnName)) {
        plan.changes.push({
          kind: 'addColumn',
          table: key,
          description: `Add column ${columnName} to ${key}`,
          statements: [buildAddColumnSql(table, columnName, dialect)],
          safe: true
        });
        continue;
      }

      const expectedColumn = table.columns[columnName];
      const actualColumn = actualColumns.get(columnName)!;
      const columnDiff = diffColumn(expectedColumn, actualColumn, dialect);
      const shouldAlter =
        columnDiff.typeChanged
        || columnDiff.nullabilityChanged
        || columnDiff.defaultChanged
        || columnDiff.autoIncrementChanged;

      if (shouldAlter) {
        const capability = dialect.mutations.alterColumn;
        if (capability) {
          const statements = capability.compile(table, expectedColumn, actualColumn, columnDiff);
          if (statements.length > 0) {
            plan.changes.push({
              kind: 'alterColumn',
              table: key,
              description: `Alter column ${columnName} on ${key}`,
              statements,
              safe: true
            });
          }
          const warning = capability.warning?.(table, expectedColumn, actualColumn, columnDiff);
          if (warning) plan.warnings.push(warning);
        } else {
          plan.warnings.push(
            unsupportedMutationWarning(dialect, 'ALTER COLUMN', `${key}.${columnName}`)
          );
        }
      }
    }

    for (const columnName of actualColumns.keys()) {
      if (table.columns[columnName]) continue;
      const capability = dialect.mutations.dropColumn;
      const statements = allowDestructive && capability
        ? capability.compile(actual, columnName)
        : [];
      plan.changes.push({
        kind: 'dropColumn',
        table: key,
        description: `Drop column ${columnName} from ${key}`,
        statements,
        safe: false
      });
      if (!capability) {
        plan.warnings.push(
          unsupportedMutationWarning(dialect, 'DROP COLUMN', `${key}.${columnName}`)
        );
      } else {
        const warning = capability.warning?.(actual, columnName);
        if (warning) plan.warnings.push(warning);
      }
    }

    const expectedIndexes = table.indexes ?? [];
    const actualIndexes = actual.indexes ?? [];
    const actualIndexMap = new Map(actualIndexes.map(index => [index.name, index]));

    for (const index of expectedIndexes) {
      const name = index.name || deriveIndexName(table, index);
      if (!actualIndexMap.has(name)) {
        plan.changes.push({
          kind: 'addIndex',
          table: key,
          description: `Create index ${name} on ${key}`,
          statements: [dialect.renderIndex(table, { ...index, name })],
          safe: true
        });
      }
    }

    for (const index of actualIndexes) {
      if (!index.name) continue;
      const expected = expectedIndexes.find(
        candidate => (candidate.name || deriveIndexName(table, candidate)) === index.name
      );
      if (expected) continue;

      const capability = dialect.mutations.dropIndex;
      const statements = allowDestructive && capability
        ? capability.compile(actual, index.name)
        : [];
      plan.changes.push({
        kind: 'dropIndex',
        table: key,
        description: `Drop index ${index.name} on ${key}`,
        statements,
        safe: false
      });
      if (!capability) {
        plan.warnings.push(
          unsupportedMutationWarning(dialect, 'DROP INDEX', `${key}.${index.name}`)
        );
      } else {
        const warning = capability.warning?.(actual, index.name);
        if (warning) plan.warnings.push(warning);
      }
    }
  }

  for (const actual of actualSchema.tables) {
    const key = tableKey(actual.name, actual.schema);
    if (expectedTables.find(table => tableKey(table.name, table.schema) === key)) continue;

    const capability = dialect.mutations.dropTable;
    const statements = allowDestructive && capability ? capability.compile(actual) : [];
    plan.changes.push({
      kind: 'dropTable',
      table: key,
      description: `Drop table ${key}`,
      statements,
      safe: false
    });
    if (!capability) {
      plan.warnings.push(unsupportedMutationWarning(dialect, 'DROP TABLE', key));
    } else {
      const warning = capability.warning?.(actual);
      if (warning) plan.warnings.push(warning);
    }
  }

  return plan;
};

export interface SynchronizeOptions extends SchemaDiffOptions {
  dryRun?: boolean;
}

export const synchronizeSchema = async (
  expectedTables: TableDef[],
  actualSchema: DatabaseSchema,
  dialect: SchemaDialect,
  executor: DbExecutor,
  options: SynchronizeOptions = {}
): Promise<SchemaPlan> => {
  const plan = diffSchema(expectedTables, actualSchema, dialect, options);
  if (!options.dryRun) {
    const { executeSchemaPlan } = await import('./schema-plan-executor.js');
    await executeSchemaPlan(plan, executor, options);
  }
  return plan;
};
