import { TableDef } from '../schema/table.js';
import { BelongsToManyRelation, HasManyRelation, HasOneRelation, BelongsToRelation } from '../schema/relation.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { inList, LiteralNode } from '../core/ast/expression.js';
import { EntityContext } from './entity-context.js';
import type { QueryResult } from '../core/execution/db-executor.js';
import { ColumnDef } from '../schema/column.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';

type Rows = Record<string, any>[];

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
      const row: Record<string, any> = {};
      columns.forEach((column, idx) => {
        row[column] = valueRow[idx];
      });
      rows.push(row);
    }
  }
  return rows;
};

const executeQuery = async (ctx: EntityContext, qb: SelectQueryBuilder<any, TableDef<any>>): Promise<Rows> => {
  const compiled = ctx.dialect.compileSelect(qb.getAST());
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  return rowsFromResults(results);
};

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const loadHasManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: HasManyRelation
): Promise<Map<string, Rows>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = new Set<unknown>();

  for (const tracked of roots) {
    const value = tracked.entity[localKey];
    if (value !== null && value !== undefined) {
      keys.add(value);
    }
  }

  if (!keys.size) {
    return new Map();
  }

  const selectMap = selectAllColumns(relation.target);
  const fb = new SelectQueryBuilder(relation.target).select(selectMap);
  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  fb.where(inList(fkColumn, Array.from(keys) as (string | number | LiteralNode)[]));

  const rows = await executeQuery(ctx, fb);
  const grouped = new Map<string, Rows>();

  for (const row of rows) {
    const fkValue = row[relation.foreignKey];
    if (fkValue === null || fkValue === undefined) continue;
    const key = toKey(fkValue);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return grouped;
};

export const loadHasOneRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: HasOneRelation
): Promise<Map<string, Record<string, any>>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = new Set<unknown>();

  for (const tracked of roots) {
    const value = tracked.entity[localKey];
    if (value !== null && value !== undefined) {
      keys.add(value);
    }
  }

  if (!keys.size) {
    return new Map();
  }

  const selectMap = selectAllColumns(relation.target);
  const qb = new SelectQueryBuilder(relation.target).select(selectMap);
  const fkColumn = relation.target.columns[relation.foreignKey];
  if (!fkColumn) return new Map();

  qb.where(inList(fkColumn, Array.from(keys) as (string | number | LiteralNode)[]));

  const rows = await executeQuery(ctx, qb);
  const lookup = new Map<string, Record<string, any>>();

  for (const row of rows) {
    const fkValue = row[relation.foreignKey];
    if (fkValue === null || fkValue === undefined) continue;
    const key = toKey(fkValue);
    if (!lookup.has(key)) {
      lookup.set(key, row);
    }
  }

  return lookup;
};

export const loadBelongsToRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: BelongsToRelation
): Promise<Map<string, Record<string, any>>> => {
  const roots = ctx.getEntitiesForTable(rootTable);
  const foreignKeys = new Set<unknown>();

  for (const tracked of roots) {
    const value = tracked.entity[relation.foreignKey];
    if (value !== null && value !== undefined) {
      foreignKeys.add(value);
    }
  }

  if (!foreignKeys.size) {
    return new Map();
  }

  const selectMap = selectAllColumns(relation.target);
  const qb = new SelectQueryBuilder(relation.target).select(selectMap);
  const targetKey = relation.localKey || findPrimaryKey(relation.target);
  const pkColumn = relation.target.columns[targetKey];
  if (!pkColumn) return new Map();

  qb.where(inList(pkColumn, Array.from(foreignKeys) as (string | number | LiteralNode)[]));
  const rows = await executeQuery(ctx, qb);
  const map = new Map<string, Record<string, any>>();

  for (const row of rows) {
    const keyValue = row[targetKey];
    if (keyValue === null || keyValue === undefined) continue;
    map.set(toKey(keyValue), row);
  }

  return map;
};

export const loadBelongsToManyRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: BelongsToManyRelation
): Promise<Map<string, Rows>> => {
  const rootKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const rootIds = new Set<unknown>();

  for (const tracked of roots) {
    const value = tracked.entity[rootKey];
    if (value !== null && value !== undefined) {
      rootIds.add(value);
    }
  }

  if (!rootIds.size) {
    return new Map();
  }

  const pivotSelect = selectAllColumns(relation.pivotTable);
  const pivotQb = new SelectQueryBuilder(relation.pivotTable).select(pivotSelect);
  const pivotFkCol = relation.pivotTable.columns[relation.pivotForeignKeyToRoot];
  if (!pivotFkCol) return new Map();

  pivotQb.where(inList(pivotFkCol, Array.from(rootIds) as (string | number | LiteralNode)[]));
  const pivotRows = await executeQuery(ctx, pivotQb);

  const rootLookup = new Map<string, { targetId: unknown; pivot: Record<string, any> }[]>();
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

  const targetSelect = selectAllColumns(relation.target);
  const targetKey = relation.targetKey || findPrimaryKey(relation.target);
  const targetPkColumn = relation.target.columns[targetKey];
  if (!targetPkColumn) return new Map();

  const targetQb = new SelectQueryBuilder(relation.target).select(targetSelect);
  targetQb.where(inList(targetPkColumn, Array.from(targetIds) as (string | number | LiteralNode)[]));
  const targetRows = await executeQuery(ctx, targetQb);
  const targetMap = new Map<string, Record<string, any>>();

  for (const row of targetRows) {
    const pkValue = row[targetKey];
    if (pkValue === null || pkValue === undefined) continue;
    targetMap.set(toKey(pkValue), row);
  }

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
