import { TableDef } from '../../schema/table.js';
import { SelectQueryBuilder } from '../../query-builder/select.js';
import { ExpressionNode, inList, LiteralNode } from '../../core/ast/expression.js';
import type { QueryResult } from '../../core/execution/db-executor.js';
import { ColumnDef } from '../../schema/column-types.js';
import { EntityContext } from '../entity-context.js';

/**
 * An array of database rows, each represented as a record of string keys to unknown values.
 */
export type Rows = Record<string, unknown>[];

/**
 * Represents a single tracked entity from the EntityContext for a table.
 */
export type EntityTracker = ReturnType<EntityContext['getEntitiesForTable']>[number];

export const hasColumns = (columns?: readonly string[]): columns is readonly string[] =>
  Boolean(columns && columns.length > 0);

export const buildColumnSelection = (
  table: TableDef,
  columns: string[],
  missingMsg: (col: string) => string
): Record<string, ColumnDef> => {
  return columns.reduce((acc, column) => {
    const def = table.columns[column];
    if (!def) {
      throw new Error(missingMsg(column));
    }
    acc[column] = def;
    return acc;
  }, {} as Record<string, ColumnDef>);
};

export const filterRow = (row: Record<string, unknown>, columns: Set<string>): Record<string, unknown> => {
  const filtered: Record<string, unknown> = {};
  for (const column of columns) {
    if (column in row) {
      filtered[column] = row[column];
    }
  }
  return filtered;
};

export const filterRows = (rows: Rows, columns: Set<string>): Rows => rows.map(row => filterRow(row, columns));

const rowsFromResults = (results: QueryResult[]): Rows => {
  const rows: Rows = [];
  for (const result of results) {
    const { columns, values } = result;
    for (const valueRow of values) {
      const row: Record<string, unknown> = {};
      columns.forEach((column, idx) => {
        row[column] = valueRow[idx];
      });
      rows.push(row);
    }
  }
  return rows;
};

const executeQuery = async (ctx: EntityContext, qb: SelectQueryBuilder<unknown, TableDef>): Promise<Rows> => {
  const compiled = ctx.dialect.compileSelect(qb.getAST());
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  return rowsFromResults(results);
};

export const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const collectKeysFromRoots = (roots: EntityTracker[], key: string): Set<unknown> => {
  const collected = new Set<unknown>();
  for (const tracked of roots) {
    const value = tracked.entity[key];
    if (value !== null && value !== undefined) {
      collected.add(value);
    }
  }
  return collected;
};

const buildInListValues = (keys: Set<unknown>): (string | number | LiteralNode)[] =>
  Array.from(keys) as (string | number | LiteralNode)[];

export const fetchRowsForKeys = async (
  ctx: EntityContext,
  table: TableDef,
  column: ColumnDef,
  keys: Set<unknown>,
  selection: Record<string, ColumnDef>,
  filter?: ExpressionNode
): Promise<Rows> => {
  let qb = new SelectQueryBuilder(table).select(selection);
  qb = qb.where(inList(column, buildInListValues(keys)));
  if (filter) {
    qb = qb.where(filter);
  }
  return executeQuery(ctx, qb);
};

export const groupRowsByMany = (rows: Rows, keyColumn: string): Map<string, Rows> => {
  const grouped = new Map<string, Rows>();
  for (const row of rows) {
    const value = row[keyColumn];
    if (value === null || value === undefined) continue;
    const key = toKey(value);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
};

export const groupRowsByUnique = (rows: Rows, keyColumn: string): Map<string, Record<string, unknown>> => {
  const lookup = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const value = row[keyColumn];
    if (value === null || value === undefined) continue;
    const key = toKey(value);
    if (!lookup.has(key)) {
      lookup.set(key, row);
    }
  }
  return lookup;
};
