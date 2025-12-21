import { TableDef } from '../../schema/table.js';
import { BelongsToManyRelation } from '../../schema/relation.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../../query-builder/relation-types.js';
import { buildDefaultPivotColumns } from '../../query-builder/relation-utils.js';
import { EntityContext } from '../entity-context.js';
import {
  buildColumnSelection,
  collectKeysFromRoots,
  fetchRowsForKeys,
  filterRow,
  groupRowsByUnique,
  hasColumns,
  toKey,
  Rows
} from './shared.js';

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

  const targetRows = await fetchRowsForKeys(
    ctx,
    relation.target,
    targetPkColumn,
    targetIds,
    targetSelection,
    options?.filter
  );
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
