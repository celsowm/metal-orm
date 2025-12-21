import type { TableDef } from '../../schema/table.js';
import type { ColumnDef } from '../../schema/column-types.js';
import type { SchemaDialect } from './schema-dialect.js';
import type { DbExecutor } from '../execution/db-executor.js';
import { resolvePrimaryKey } from './sql-writing.js';
import { DialectName } from './schema-dialect.js';

/** Result of generating schema SQL. */
export interface SchemaGenerateResult {
  tableSql: string;
  indexSql: string[];
}

/** Options for rendering column definitions. */
export interface RenderColumnOptions {
  includePrimary?: boolean;
}

/**
 * Renders a column definition for SQL.
 * @param table - The table definition.
 * @param col - The column definition.
 * @param dialect - The schema dialect.
 * @param options - Options for rendering.
 * @returns The rendered SQL and whether primary key is inline.
 */
export const renderColumnDefinition = (
  table: TableDef,
  col: ColumnDef,
  dialect: SchemaDialect,
  options: RenderColumnOptions = {}
): { sql: string; inlinePrimary: boolean } => {
  const parts: string[] = [];
  parts.push(dialect.quoteIdentifier(col.name));
  parts.push(dialect.renderColumnType(col));

  const autoInc = dialect.renderAutoIncrement(col, table);
  if (autoInc) parts.push(autoInc);

  if (col.notNull) parts.push('NOT NULL');
  if (col.unique) parts.push('UNIQUE');
  if (col.default !== undefined) {
    parts.push(`DEFAULT ${dialect.renderDefault(col.default, col)}`);
  }
  const autoIncIncludesPrimary = typeof autoInc === 'string' && /\bPRIMARY\s+KEY\b/i.test(autoInc);
  if (options.includePrimary && col.primary && !autoIncIncludesPrimary) {
    parts.push('PRIMARY KEY');
  }
  if (col.check) {
    parts.push(`CHECK (${col.check})`);
  }
  if (col.references) {
    parts.push(dialect.renderReference(col.references, table));
  }

  return { sql: parts.join(' '), inlinePrimary: !!(options.includePrimary && col.primary) };
};

/**
 * Generates SQL to create a table.
 * @param table - The table definition.
 * @param dialect - The schema dialect.
 * @returns The table SQL and index SQL.
 */
export const generateCreateTableSql = (
  table: TableDef,
  dialect: SchemaDialect
): SchemaGenerateResult => {
  const pk = resolvePrimaryKey(table);
  const inlinePkColumns = new Set<string>();

  const columnLines = Object.values(table.columns).map(col => {
    const includePk = dialect.preferInlinePkAutoincrement(col, table, pk) && pk.includes(col.name);
    if (includePk) {
      inlinePkColumns.add(col.name);
    }
    return renderColumnDefinition(table, col, dialect, { includePrimary: includePk }).sql;
  });

  const constraintLines: string[] = [];

  if (pk.length > 0 && !(pk.length === 1 && inlinePkColumns.has(pk[0]))) {
    const cols = pk.map(c => dialect.quoteIdentifier(c)).join(', ');
    constraintLines.push(`PRIMARY KEY (${cols})`);
  }

  if (table.checks) {
    table.checks.forEach(check => {
      const name = check.name ? `${dialect.quoteIdentifier(check.name)} ` : '';
      constraintLines.push(`CONSTRAINT ${name}CHECK (${check.expression})`);
    });
  }

  const allLines = [...columnLines, ...constraintLines];
  const body = allLines.map(line => `  ${line}`).join(',\n');
  const tableOptions = dialect.renderTableOptions(table);
  const tableSql = `CREATE TABLE ${dialect.formatTableName(table)} (\n${body}\n)${tableOptions ? ' ' + tableOptions : ''};`;

  const indexSql: string[] = [];
  if (table.indexes && table.indexes.length > 0) {
    for (const idx of table.indexes) {
      if (idx.where && !dialect.supportsPartialIndexes()) {
        throw new Error(`Dialect ${dialect.name} does not support partial/filtered indexes (${idx.name || idx.columns.join('_')}).`);
      }
      indexSql.push(dialect.renderIndex(table, idx));
    }
  }

  return { tableSql, indexSql };
};

/**
 * Generates SQL for creating multiple tables.
 * @param tables - The table definitions.
 * @param dialect - The schema dialect.
 * @returns The SQL statements.
 */
export const generateSchemaSql = (
  tables: TableDef[],
  dialect: SchemaDialect
): string[] => {
  const ordered = orderTablesByDependencies(tables);
  const statements: string[] = [];
  ordered.forEach(table => {
    const { tableSql, indexSql } = generateCreateTableSql(table, dialect);
    statements.push(tableSql, ...indexSql);
  });
  return statements;
};

/**
 * Convenience wrapper for generateSchemaSql with rest args.
 * @param dialect - The schema dialect used to render SQL.
 * @param tables - The table definitions to create.
 */
export const generateSchemaSqlFor = (
  dialect: SchemaDialect,
  ...tables: TableDef[]
): string[] => generateSchemaSql(tables, dialect);

/**
 * Generates and executes schema SQL for the provided tables.
 * @param executor - The database executor to run statements with.
 * @param tables - The table definitions to create.
 * @param dialect - The schema dialect used to render SQL.
 */
export const executeSchemaSql = async (
  executor: DbExecutor,
  tables: TableDef[],
  dialect: SchemaDialect
): Promise<void> => {
  const statements = generateSchemaSql(tables, dialect);
  for (const sql of statements) {
    await executor.executeSql(sql);
  }
};

/**
 * Convenience wrapper for executeSchemaSql with rest args.
 * @param executor - The database executor to run statements with.
 * @param dialect - The schema dialect used to render SQL.
 * @param tables - The table definitions to create.
 */
export const executeSchemaSqlFor = async (
  executor: DbExecutor,
  dialect: SchemaDialect,
  ...tables: TableDef[]
): Promise<void> => {
  await executeSchemaSql(executor, tables, dialect);
};

const orderTablesByDependencies = (tables: TableDef[]): TableDef[] => {
  const map = new Map<string, TableDef>();
  tables.forEach(t => map.set(t.name, t));

  const deps = new Map<string, Set<string>>();
  for (const table of tables) {
    const refTables = new Set<string>();
    Object.values(table.columns).forEach(col => {
      if (col.references?.table) {
        refTables.add(col.references.table);
      }
    });
    deps.set(table.name, refTables);
  }

  const visited = new Set<string>();
  const ordered: TableDef[] = [];

  const visit = (name: string, stack: Set<string>) => {
    if (visited.has(name)) return;
    const table = map.get(name);
    if (!table) return;
    if (stack.has(name)) {
      ordered.push(table);
      visited.add(name);
      return;
    }
    stack.add(name);
    for (const dep of deps.get(name) || []) {
      visit(dep, stack);
    }
    stack.delete(name);
    visited.add(name);
    ordered.push(table);
  };

  tables.forEach(t => visit(t.name, new Set()));
  return ordered;
};

// Re-export DialectName for backward compatibility
export type { DialectName };

