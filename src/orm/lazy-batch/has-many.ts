import { TableDef } from '../../schema/table.js';
import { HasManyRelation } from '../../schema/relation.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../../query-builder/relation-types.js';
import { EntityContext } from '../entity-context.js';
import {
  buildColumnSelection,
  collectKeysFromRoots,
  fetchRowsForKeys,
  filterRows,
  groupRowsByMany,
  hasColumns,
  Rows
} from './shared.js';

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
