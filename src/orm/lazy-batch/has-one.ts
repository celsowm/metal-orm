import { TableDef } from '../../schema/table.js';
import { HasOneRelation } from '../../schema/relation.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../../query-builder/relation-types.js';
import { EntityContext } from '../entity-context.js';
import {
  buildColumnSelection,
  collectKeysFromRoots,
  fetchRowsForKeys,
  filterRow,
  groupRowsByUnique,
  hasColumns
} from './shared.js';

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
