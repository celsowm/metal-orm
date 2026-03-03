import { TableDef } from '../../schema/table.js';
import { MorphToRelation } from '../../schema/relation.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
import { EntityContext } from '../entity-context.js';
import {
  buildColumnSelection,
  fetchRowsForKeys,
  toKey
} from './shared.js';

export const loadMorphToRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  _relationName: string,
  relation: MorphToRelation
): Promise<Map<string, Record<string, unknown>>> => {
  const roots = ctx.getEntitiesForTable(rootTable);
  const result = new Map<string, Record<string, unknown>>();

  // Group root entities by type value
  const grouped = new Map<string, Set<unknown>>();
  for (const tracked of roots) {
    const entity = tracked.entity as Record<string, unknown>;
    const typeValue = entity[relation.typeField];
    const idValue = entity[relation.idField];
    if (!typeValue || idValue === undefined || idValue === null) continue;
    const typeKey = toKey(typeValue);
    const ids = grouped.get(typeKey) ?? new Set();
    ids.add(idValue);
    grouped.set(typeKey, ids);
  }

  // For each type, load from the corresponding target table
  for (const [typeKey, ids] of grouped.entries()) {
    const targetTable = relation.targets[typeKey];
    if (!targetTable) continue;

    const targetPk = relation.targetKey || findPrimaryKey(targetTable);
    const pkColumn = targetTable.columns[targetPk];
    if (!pkColumn) continue;

    const selection = buildColumnSelection(
      targetTable,
      Object.keys(targetTable.columns),
      column => `Column '${column}' not found on target '${targetTable.name}'`
    );

    const rows = await fetchRowsForKeys(ctx, targetTable, pkColumn, ids, selection);

    for (const row of rows) {
      const pkValue = row[targetPk];
      if (pkValue === undefined || pkValue === null) continue;
      const compositeKey = `${typeKey}:${toKey(pkValue)}`;
      result.set(compositeKey, row);
    }
  }

  return result;
};
