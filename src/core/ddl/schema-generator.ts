import { ColumnDef, ForeignKeyReference, RawDefaultValue } from '../../schema/column.js';
import { IndexDef, IndexColumn, TableDef } from '../../schema/table.js';
import { DatabaseTable } from './schema-types.js';
export { BaseSchemaDialect } from './dialects/base-schema-dialect.js';
export {
  PostgresSchemaDialect,
  MySqlSchemaDialect,
  SQLiteSchemaDialect,
  MSSqlSchemaDialect
} from './dialects/index.js';

export type DialectName = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

export interface SchemaDialect {
  name: DialectName;
  quoteIdentifier(id: string): string;
  formatTableName(table: TableDef | DatabaseTable): string;
  renderColumnType(column: ColumnDef): string;
  renderDefault(value: unknown, column: ColumnDef): string;
  renderAutoIncrement(column: ColumnDef, table: TableDef): string | undefined;
  renderReference(ref: ForeignKeyReference, table: TableDef): string;
  renderIndex(table: TableDef, index: IndexDef): string;
  renderTableOptions(table: TableDef): string | undefined;
  supportsPartialIndexes(): boolean;
  preferInlinePkAutoincrement?(column: ColumnDef, table: TableDef, pk: string[]): boolean;
  dropColumnSql(table: DatabaseTable, column: string): string[];
  dropIndexSql(table: DatabaseTable, index: string): string[];
  dropTableSql(table: DatabaseTable): string[];
  warnDropColumn?(table: DatabaseTable, column: string): string | undefined;
}

export interface SchemaGenerateResult {
  tableSql: string;
  indexSql: string[];
}

export const escapeLiteral = (value: string): string => value.replace(/'/g, "''");

const isRawDefault = (value: unknown): value is RawDefaultValue => {
  return !!value && typeof value === 'object' && 'raw' in (value as any) && typeof (value as any).raw === 'string';
};

export const formatLiteral = (value: unknown, dialect: DialectName): string => {
  if (isRawDefault(value)) return value.raw;
  if (value === null) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') {
    if (dialect === 'mysql' || dialect === 'sqlite' || dialect === 'mssql') {
      return value ? '1' : '0';
    }
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) return `'${escapeLiteral(value.toISOString())}'`;
  if (typeof value === 'string') return `'${escapeLiteral(value)}'`;
  return `'${escapeLiteral(JSON.stringify(value))}'`;
};

export const resolvePrimaryKey = (table: TableDef): string[] => {
  if (table.primaryKey && table.primaryKey.length > 0) {
    return table.primaryKey;
  }
  const cols = Object.values(table.columns);
  return cols.filter(c => c.primary).map(c => c.name);
};

export const quoteQualified = (dialect: SchemaDialect, identifier: string): string => {
  if (identifier.includes('.')) {
    return identifier
      .split('.')
      .map(part => dialect.quoteIdentifier(part))
      .join('.');
  }
  return dialect.quoteIdentifier(identifier);
};

export const renderIndexColumns = (dialect: SchemaDialect, columns: (string | IndexColumn)[]) => {
  return columns
    .map(col => {
      if (typeof col === 'string') return dialect.quoteIdentifier(col);
      const parts = [dialect.quoteIdentifier(col.column)];
      if (col.order) parts.push(col.order);
      if (col.nulls) parts.push(`NULLS ${col.nulls}`);
      return parts.join(' ');
    })
    .join(', ');
};

export const deriveIndexName = (table: TableDef, index: IndexDef): string => {
  const base = (index.columns || [])
    .map(col => (typeof col === 'string' ? col : col.column))
    .join('_');
  const suffix = index.unique ? 'uniq' : 'idx';
  return `${table.name}_${base}_${suffix}`;
};

export interface RenderColumnOptions {
  includePrimary?: boolean;
}

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
  if (options.includePrimary && col.primary) {
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

export const generateCreateTableSql = (
  table: TableDef,
  dialect: SchemaDialect
): SchemaGenerateResult => {
  const pk = resolvePrimaryKey(table);
  const inlinePkColumns = new Set<string>();

  const columnLines = Object.values(table.columns).map(col => {
    const includePk = dialect.preferInlinePkAutoincrement?.(col, table, pk) && pk.includes(col.name);
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
