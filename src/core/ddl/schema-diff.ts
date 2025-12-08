import { TableDef } from '../../schema/table.js';
import { ColumnDef } from '../../schema/column.js';
import type { DbExecutor } from '../execution/db-executor.js';
import { SchemaDialect } from './schema-dialect.js';
import { deriveIndexName } from './naming-strategy.js';
import { generateCreateTableSql, renderColumnDefinition } from './schema-generator.js';
import { ColumnDiff, DatabaseColumn, DatabaseSchema, DatabaseTable } from './schema-types.js';

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
  /** Allow destructive operations (drops) */
  allowDestructive?: boolean;
}

const tableKey = (name: string, schema?: string) => (schema ? `${schema}.${name}` : name);

const mapTables = (schema: DatabaseSchema) => {
  const map = new Map<string, DatabaseTable>();
  for (const table of schema.tables) {
    map.set(tableKey(table.name, table.schema), table);
  }
  return map;
};

const buildAddColumnSql = (table: TableDef, colName: string, dialect: SchemaDialect): string => {
  const column = table.columns[colName];
  const rendered = renderColumnDefinition(table, column, dialect);
  return `ALTER TABLE ${dialect.formatTableName(table)} ADD ${rendered.sql};`;
};

const normalizeType = (value: string | undefined): string => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const normalizeDefault = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
};

const diffColumn = (expected: ColumnDef, actual: DatabaseColumn, dialect: SchemaDialect): ColumnDiff => {
  const expectedType = normalizeType(dialect.renderColumnType(expected));
  const actualType = normalizeType(actual.type);
  const expectedDefault =
    expected.default !== undefined ? normalizeDefault(dialect.renderDefault(expected.default, expected)) : undefined;
  const actualDefault = normalizeDefault(actual.default);
  return {
    typeChanged: expectedType !== actualType,
    nullabilityChanged: !!expected.notNull !== !!actual.notNull,
    defaultChanged: expectedDefault !== actualDefault,
    autoIncrementChanged: !!expected.autoIncrement !== !!actual.autoIncrement
  };
};

export const diffSchema = (
  expectedTables: TableDef[],
  actualSchema: DatabaseSchema,
  dialect: SchemaDialect,
  options: SchemaDiffOptions = {}
): SchemaPlan => {
  const allowDestructive = options.allowDestructive ?? false;
  const plan: SchemaPlan = { changes: [], warnings: [] };

  const actualMap = mapTables(actualSchema);

  // Create missing tables and indexes
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

    // Columns
    const actualCols = new Map(actual.columns.map(c => [c.name, c]));
    for (const colName of Object.keys(table.columns)) {
      if (!actualCols.has(colName)) {
        plan.changes.push({
          kind: 'addColumn',
          table: key,
          description: `Add column ${colName} to ${key}`,
          statements: [buildAddColumnSql(table, colName, dialect)],
          safe: true
        });
      } else {
        const expectedCol = table.columns[colName];
        const actualCol = actualCols.get(colName)!;
        const colDiff = diffColumn(expectedCol, actualCol, dialect);
        const shouldAlter =
          colDiff.typeChanged || colDiff.nullabilityChanged || colDiff.defaultChanged || colDiff.autoIncrementChanged;
        if (shouldAlter) {
          const statements = dialect.alterColumnSql?.(table, expectedCol, actualCol, colDiff) ?? [];
          if (statements.length > 0) {
            plan.changes.push({
              kind: 'alterColumn',
              table: key,
              description: `Alter column ${colName} on ${key}`,
              statements,
              safe: true
            });
          }
          const warning = dialect.warnAlterColumn?.(table, expectedCol, actualCol, colDiff);
          if (warning) plan.warnings.push(warning);
        }
      }
    }
    for (const colName of actualCols.keys()) {
      if (!table.columns[colName]) {
        plan.changes.push({
          kind: 'dropColumn',
          table: key,
          description: `Drop column ${colName} from ${key}`,
          statements: allowDestructive ? dialect.dropColumnSql(actual, colName) : [],
          safe: false
        });
        const warning = dialect.warnDropColumn?.(actual, colName);
        if (warning) plan.warnings.push(warning);
      }
    }

    // Indexes (naive: based on name or derived name)
    const expectedIndexes = table.indexes ?? [];
    const actualIndexes = actual.indexes ?? [];
    const actualIndexMap = new Map(actualIndexes.map(idx => [idx.name, idx]));

    for (const idx of expectedIndexes) {
      const name = idx.name || deriveIndexName(table, idx);
      if (!actualIndexMap.has(name)) {
        plan.changes.push({
          kind: 'addIndex',
          table: key,
          description: `Create index ${name} on ${key}`,
          statements: [dialect.renderIndex(table, { ...idx, name })],
          safe: true
        });
      }
    }

    for (const idx of actualIndexes) {
      if (idx.name && !expectedIndexes.find(expected => (expected.name || deriveIndexName(table, expected)) === idx.name)) {
        plan.changes.push({
          kind: 'dropIndex',
          table: key,
          description: `Drop index ${idx.name} on ${key}`,
          statements: allowDestructive ? dialect.dropIndexSql(actual, idx.name) : [],
          safe: false
        });
      }
    }
  }

  // Extra tables
  for (const actual of actualSchema.tables) {
    const key = tableKey(actual.name, actual.schema);
    if (!expectedTables.find(t => tableKey(t.name, t.schema) === key)) {
      plan.changes.push({
        kind: 'dropTable',
        table: key,
        description: `Drop table ${key}`,
        statements: allowDestructive ? dialect.dropTableSql(actual) : [],
        safe: false
      });
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
