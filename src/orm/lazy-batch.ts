import { TableDef } from '../schema/table.js';
import { BelongsToManyRelation, HasManyRelation, HasOneRelation, BelongsToRelation } from '../schema/relation.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { ExpressionNode, inList, LiteralNode } from '../core/ast/expression.js';
import { EntityContext } from './entity-context.js';
import type { QueryResult } from '../core/execution/db-executor.js';
import { ColumnDef } from '../schema/column-types.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../query-builder/relation-types.js';
import { buildDefaultPivotColumns } from '../query-builder/relation-utils.js';

/**
 * An array of database rows, each represented as a record of string keys to unknown values.
 */
type Rows = Record<string, unknown>[];

/**
 * Represents a single tracked entity from the EntityContext for a table.
 */
type EntityTracker = ReturnType<EntityContext['getEntitiesForTable']>[number];

const hasColumns = (columns?: readonly string[]): columns is readonly string[] =>
  Boolean(columns && columns.length > 0);

const buildColumnSelection = (
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

const filterRow = (row: Record<string, unknown>, columns: Set<string>): Record<string, unknown> => {
  const filtered: Record<string, unknown> = {};
  for (const column of columns) {
    if (column in row) {
      filtered[column] = row[column];
    }
  }
  return filtered;
};

const filterRows = (rows: Rows, columns: Set<string>): Rows => rows.map(row => filterRow(row, columns));

/**
 * Extracts rows from query results into a standardized format.
 * @param results - The query results to process.
 * @returns An array of rows as records.
 */
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

/**
 * Executes a select query and returns the resulting rows.
 * @param ctx - The entity context for execution.
 * @param qb - The select query builder.
 * @returns A promise resolving to the rows from the query.
 */
const executeQuery = async (ctx: EntityContext, qb: SelectQueryBuilder<unknown, TableDef>): Promise<Rows> => {
  const compiled = ctx.dialect.compileSelect(qb.getAST());
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  return rowsFromResults(results);
};

/**
 * Converts a value to a string key, handling null and undefined as empty string.
 * @param value - The value to convert.
 * @returns The string representation of the value.
 */
const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * Collects unique keys from the root entities based on the specified key property.
 * @param roots - The tracked entities to collect keys from.
 * @param key - The property name to use as the key.
 * @returns A set of unique key values.
 */
const collectKeysFromRoots = (roots: EntityTracker[], key: string): Set<unknown> => {
  const collected = new Set<unknown>();
  for (const tracked of roots) {
    const value = tracked.entity[key];
    if (value !== null && value !== undefined) {
      collected.add(value);
    }
  }
  return collected;
};

/**
 * Builds an array of values suitable for an IN list expression from a set of keys.
 * @param keys - The set of keys to convert.
 * @returns An array of string, number, or LiteralNode values.
 */
const buildInListValues = (keys: Set<unknown>): (string | number | LiteralNode)[] =>
  Array.from(keys) as (string | number | LiteralNode)[];

/**
 * Fetches rows from a table where the specified column matches any of the given keys.
 * @param ctx - The entity context.
 * @param table - The target table.
 * @param column - The column to match against.
 * @param keys - The set of keys to match.
 * @returns A promise resolving to the matching rows.
 */
const fetchRowsForKeys = async (
  ctx: EntityContext,
  table: TableDef,
  column: ColumnDef,
  keys: Set<unknown>,
  selection: Record<string, ColumnDef>,
  filter?: ExpressionNode
): Promise<Rows> => {
  const qb = new SelectQueryBuilder(table).select(selection);
  qb.where(inList(column, buildInListValues(keys)));
  if (filter) {
    qb.where(filter);
  }
  return executeQuery(ctx, qb);
};

/**
 * Groups rows by the value of a key column, allowing multiple rows per key.
 * @param rows - The rows to group.
 * @param keyColumn - The column name to group by.
 * @returns A map from key strings to arrays of rows.
 */
const groupRowsByMany = (rows: Rows, keyColumn: string): Map<string, Rows> => {
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

/**
 * Groups rows by the value of a key column, keeping only one row per key.
 * @param rows - The rows to group.
 * @param keyColumn - The column name to group by.
 * @returns A map from key strings to single rows.
 */
const groupRowsByUnique = (rows: Rows, keyColumn: string): Map<string, Record<string, unknown>> => {
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

/**
 * Loads related entities for a has-many relation in batch.
 * @param ctx - The entity context.
 * @param rootTable - The root table of the relation.
 * @param _relationName - The name of the relation (unused).
 * @param relation - The has-many relation definition.
 * @returns A promise resolving to a map of root keys to arrays of related rows.
 */
export const loadHasManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  relationName: string,
  relation: HasManyRelation,
  options?: RelationIncludeOptions
): Promise<Map<string, Rows>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = collectKeysFromRoots(roots, localKey);

  if (!keys.size) {
    return new Map();
  }

  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  const requestedColumns = hasColumns(options?.columns) ? [...options!.columns] : undefined;
  const targetPrimaryKey = findPrimaryKey(relation.target);
  const selectedColumns = requestedColumns ? [...requestedColumns] : Object.keys(relation.target.columns);
  if (!selectedColumns.includes(targetPrimaryKey)) {
    selectedColumns.push(targetPrimaryKey);
  }

  const queryColumns = new Set(selectedColumns);
  queryColumns.add(relation.foreignKey);

  const selection = buildColumnSelection(
    relation.target,
    Array.from(queryColumns),
    column => `Column '${column}' not found on relation '${relationName}'`
  );

  const rows = await fetchRowsForKeys(ctx, relation.target, fkColumn, keys, selection, options?.filter);
  const grouped = groupRowsByMany(rows, relation.foreignKey);

  if (!requestedColumns) return grouped;

  const visibleColumns = new Set(selectedColumns);
  const filtered = new Map<string, Rows>();
  for (const [key, bucket] of grouped.entries()) {
    filtered.set(key, filterRows(bucket, visibleColumns));
  }
  return filtered;
};

/**
 * Loads related entities for a has-one relation in batch.
 * @param ctx - The entity context.
 * @param rootTable - The root table of the relation.
 * @param _relationName - The name of the relation (unused).
 * @param relation - The has-one relation definition.
 * @returns A promise resolving to a map of root keys to single related rows.
 */
export const loadHasOneRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  relationName: string,
  relation: HasOneRelation,
  options?: RelationIncludeOptions
): Promise<Map<string, Record<string, unknown>>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = collectKeysFromRoots(roots, localKey);

  if (!keys.size) {
    return new Map();
  }

  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  const requestedColumns = hasColumns(options?.columns) ? [...options!.columns] : undefined;
  const targetPrimaryKey = findPrimaryKey(relation.target);
  const selectedColumns = requestedColumns ? [...requestedColumns] : Object.keys(relation.target.columns);
  if (!selectedColumns.includes(targetPrimaryKey)) {
    selectedColumns.push(targetPrimaryKey);
  }

  const queryColumns = new Set(selectedColumns);
  queryColumns.add(relation.foreignKey);

  const selection = buildColumnSelection(
    relation.target,
    Array.from(queryColumns),
    column => `Column '${column}' not found on relation '${relationName}'`
  );

  const rows = await fetchRowsForKeys(ctx, relation.target, fkColumn, keys, selection, options?.filter);
  const grouped = groupRowsByUnique(rows, relation.foreignKey);

  if (!requestedColumns) return grouped;

  const visibleColumns = new Set(selectedColumns);
  const filtered = new Map<string, Record<string, unknown>>();
  for (const [key, row] of grouped.entries()) {
    filtered.set(key, filterRow(row, visibleColumns));
  }
  return filtered;
};

/**
 * Loads related entities for a belongs-to relation in batch.
 * @param ctx - The entity context.
 * @param rootTable - The root table of the relation.
 * @param _relationName - The name of the relation (unused).
 * @param relation - The belongs-to relation definition.
 * @returns A promise resolving to a map of foreign keys to single related rows.
 */
export const loadBelongsToRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  relationName: string,
  relation: BelongsToRelation,
  options?: RelationIncludeOptions
): Promise<Map<string, Record<string, unknown>>> => {
  const roots = ctx.getEntitiesForTable(rootTable);
  const foreignKeys = collectKeysFromRoots(roots, relation.foreignKey);

  if (!foreignKeys.size) {
    return new Map();
  }

  const targetKey = relation.localKey || findPrimaryKey(relation.target);
  const pkColumn = relation.target.columns[targetKey];
  if (!pkColumn) return new Map();

  const requestedColumns = hasColumns(options?.columns) ? [...options!.columns] : undefined;
  const selectedColumns = requestedColumns ? [...requestedColumns] : Object.keys(relation.target.columns);
  if (!selectedColumns.includes(targetKey)) {
    selectedColumns.push(targetKey);
  }

  const selection = buildColumnSelection(
    relation.target,
    selectedColumns,
    column => `Column '${column}' not found on relation '${relationName}'`
  );

  const rows = await fetchRowsForKeys(ctx, relation.target, pkColumn, foreignKeys, selection, options?.filter);
  const grouped = groupRowsByUnique(rows, targetKey);

  if (!requestedColumns) return grouped;

  const visibleColumns = new Set(selectedColumns);
  const filtered = new Map<string, Record<string, unknown>>();
  for (const [key, row] of grouped.entries()) {
    filtered.set(key, filterRow(row, visibleColumns));
  }
  return filtered;
};

/**
 * Loads related entities for a belongs-to-many relation in batch, including pivot data.
 * @param ctx - The entity context.
 * @param rootTable - The root table of the relation.
 * @param _relationName - The name of the relation (unused).
 * @param relation - The belongs-to-many relation definition.
 * @returns A promise resolving to a map of root keys to arrays of related rows with pivot data.
 */
export const loadBelongsToManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  relationName: string,
  relation: BelongsToManyRelation,
  options?: RelationIncludeOptions
): Promise<Map<string, Rows>> => {
  const rootKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const rootIds = collectKeysFromRoots(roots, rootKey);

  if (!rootIds.size) {
    return new Map();
  }

  const pivotColumn = relation.pivotTable.columns[relation.pivotForeignKeyToRoot];
  if (!pivotColumn) return new Map();

  const pivotColumnsRequested = hasColumns(options?.pivot?.columns) ? [...options!.pivot!.columns] : undefined;
  const useIncludeDefaults = options !== undefined;
  let pivotSelectedColumns: string[];
  if (pivotColumnsRequested) {
    pivotSelectedColumns = [...pivotColumnsRequested];
  } else if (useIncludeDefaults) {
    const pivotPk = relation.pivotPrimaryKey || findPrimaryKey(relation.pivotTable);
    pivotSelectedColumns = relation.defaultPivotColumns ?? buildDefaultPivotColumns(relation, pivotPk);
  } else {
    pivotSelectedColumns = Object.keys(relation.pivotTable.columns);
  }

  const pivotQueryColumns = new Set(pivotSelectedColumns);
  pivotQueryColumns.add(relation.pivotForeignKeyToRoot);
  pivotQueryColumns.add(relation.pivotForeignKeyToTarget);

  const pivotSelection = buildColumnSelection(
    relation.pivotTable,
    Array.from(pivotQueryColumns),
    column => `Column '${column}' not found on pivot table '${relation.pivotTable.name}'`
  );

  const pivotRows = await fetchRowsForKeys(ctx, relation.pivotTable, pivotColumn, rootIds, pivotSelection);
  const rootLookup = new Map<string, { targetId: unknown; pivot: Record<string, unknown> }[]>();
  const targetIds = new Set<unknown>();
  const pivotVisibleColumns = new Set(pivotSelectedColumns);

  for (const pivot of pivotRows) {
    const rootValue = pivot[relation.pivotForeignKeyToRoot];
    const targetValue = pivot[relation.pivotForeignKeyToTarget];
    if (rootValue === null || rootValue === undefined || targetValue === null || targetValue === undefined) {
      continue;
    }
    const bucket = rootLookup.get(toKey(rootValue)) ?? [];
    bucket.push({
      targetId: targetValue,
      pivot: pivotVisibleColumns.size ? filterRow(pivot, pivotVisibleColumns) : {}
    });
    rootLookup.set(toKey(rootValue), bucket);
    targetIds.add(targetValue);
  }

  if (!targetIds.size) {
    return new Map();
  }

  const targetKey = relation.targetKey || findPrimaryKey(relation.target);
  const targetPkColumn = relation.target.columns[targetKey];
  if (!targetPkColumn) return new Map();

  const targetRequestedColumns = hasColumns(options?.columns) ? [...options!.columns] : undefined;
  const targetSelectedColumns = targetRequestedColumns
    ? [...targetRequestedColumns]
    : Object.keys(relation.target.columns);
  if (!targetSelectedColumns.includes(targetKey)) {
    targetSelectedColumns.push(targetKey);
  }

  const targetSelection = buildColumnSelection(
    relation.target,
    targetSelectedColumns,
    column => `Column '${column}' not found on relation '${relationName}'`
  );

  const targetRows = await fetchRowsForKeys(ctx, relation.target, targetPkColumn, targetIds, targetSelection, options?.filter);
  const targetMap = groupRowsByUnique(targetRows, targetKey);
  const targetVisibleColumns = new Set(targetSelectedColumns);
  const result = new Map<string, Rows>();

  for (const [rootId, entries] of rootLookup.entries()) {
    const bucket: Rows = [];
    for (const entry of entries) {
      const targetRow = targetMap.get(toKey(entry.targetId));
      if (!targetRow) continue;
      bucket.push({
        ...(targetRequestedColumns ? filterRow(targetRow, targetVisibleColumns) : targetRow),
        _pivot: entry.pivot
      });
    }
    result.set(rootId, bucket);
  }

  return result;
};

