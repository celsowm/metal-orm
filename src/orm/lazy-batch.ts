import { TableDef } from '../schema/table.js';
import { BelongsToManyRelation, HasManyRelation, HasOneRelation, BelongsToRelation } from '../schema/relation.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { inList, LiteralNode } from '../core/ast/expression.js';
import { EntityContext } from './entity-context.js';
import type { QueryResult } from '../core/execution/db-executor.js';
import { ColumnDef } from '../schema/column.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';

type Rows = Record<string, unknown>[];

type EntityTracker = ReturnType<EntityContext['getEntitiesForTable']>[number];

const selectAllColumns = (table: TableDef): Record<string, ColumnDef> =>
  Object.entries(table.columns).reduce((acc, [name, def]) => {
    acc[name] = def;
    return acc;
  }, {} as Record<string, ColumnDef>);

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

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

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

const buildInListValues = (keys: Set<unknown>): (string | number | LiteralNode)[] =>
  Array.from(keys) as (string | number | LiteralNode)[];

const fetchRowsForKeys = async (
  ctx: EntityContext,
  table: TableDef,
  column: ColumnDef,
  keys: Set<unknown>
): Promise<Rows> => {
  const qb = new SelectQueryBuilder(table).select(selectAllColumns(table));
  qb.where(inList(column, buildInListValues(keys)));
  return executeQuery(ctx, qb);
};

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

export const loadHasManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: HasManyRelation
): Promise<Map<string, Rows>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = collectKeysFromRoots(roots, localKey);

  if (!keys.size) {
    return new Map();
  }

  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  const rows = await fetchRowsForKeys(ctx, relation.target, fkColumn, keys);
  return groupRowsByMany(rows, relation.foreignKey);
};

export const loadHasOneRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: HasOneRelation
): Promise<Map<string, Record<string, unknown>>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = collectKeysFromRoots(roots, localKey);

  if (!keys.size) {
    return new Map();
  }

  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  const rows = await fetchRowsForKeys(ctx, relation.target, fkColumn, keys);
  return groupRowsByUnique(rows, relation.foreignKey);
};

export const loadBelongsToRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: BelongsToRelation
): Promise<Map<string, Record<string, unknown>>> => {
  const roots = ctx.getEntitiesForTable(rootTable);
  const foreignKeys = collectKeysFromRoots(roots, relation.foreignKey);

  if (!foreignKeys.size) {
    return new Map();
  }

  const targetKey = relation.localKey || findPrimaryKey(relation.target);
  const pkColumn = relation.target.columns[targetKey];
  if (!pkColumn) return new Map();

  const rows = await fetchRowsForKeys(ctx, relation.target, pkColumn, foreignKeys);
  return groupRowsByUnique(rows, targetKey);
};

export const loadBelongsToManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: BelongsToManyRelation
): Promise<Map<string, Rows>> => {
  const rootKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const rootIds = collectKeysFromRoots(roots, rootKey);

  if (!rootIds.size) {
    return new Map();
  }

  const pivotColumn = relation.pivotTable.columns[relation.pivotForeignKeyToRoot];
  if (!pivotColumn) return new Map();

  const pivotRows = await fetchRowsForKeys(ctx, relation.pivotTable, pivotColumn, rootIds);
  const rootLookup = new Map<string, { targetId: unknown; pivot: Record<string, unknown> }[]>();
  const targetIds = new Set<unknown>();

  for (const pivot of pivotRows) {
    const rootValue = pivot[relation.pivotForeignKeyToRoot];
    const targetValue = pivot[relation.pivotForeignKeyToTarget];
    if (rootValue === null || rootValue === undefined || targetValue === null || targetValue === undefined) {
      continue;
    }
    const bucket = rootLookup.get(toKey(rootValue)) ?? [];
    bucket.push({
      targetId: targetValue,
      pivot: { ...pivot }
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

  const targetRows = await fetchRowsForKeys(ctx, relation.target, targetPkColumn, targetIds);
  const targetMap = groupRowsByUnique(targetRows, targetKey);
  const result = new Map<string, Rows>();

  for (const [rootId, entries] of rootLookup.entries()) {
    const bucket: Rows = [];
    for (const entry of entries) {
      const targetRow = targetMap.get(toKey(entry.targetId));
      if (!targetRow) continue;
      bucket.push({
        ...targetRow,
        _pivot: entry.pivot
      });
    }
    result.set(rootId, bucket);
  }

  return result;
};
