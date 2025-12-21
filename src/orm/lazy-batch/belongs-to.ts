import { TableDef } from '../../schema/table.js';
import { BelongsToRelation } from '../../schema/relation.js';
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

  const getForeignKeys = (): Set<unknown> => collectKeysFromRoots(roots, relation.foreignKey);
  let foreignKeys = getForeignKeys();

  if (!foreignKeys.size) {
    const pkName = findPrimaryKey(rootTable);
    const pkColumn = rootTable.columns[pkName];
    const fkColumn = rootTable.columns[relation.foreignKey];

    if (pkColumn && fkColumn) {
      const missingKeys = new Set<unknown>();
      const entityByPk = new Map<unknown, Record<string, unknown>>();

      for (const tracked of roots) {
        const entity = tracked.entity as Record<string, unknown>;
        const pkValue = entity[pkName];
        if (pkValue === undefined || pkValue === null) continue;
        const fkValue = entity[relation.foreignKey];
        if (fkValue === undefined || fkValue === null) {
          missingKeys.add(pkValue);
          entityByPk.set(pkValue, entity);
        }
      }

      if (missingKeys.size) {
        const selection = buildColumnSelection(
          rootTable,
          [pkName, relation.foreignKey],
          column => `Column '${column}' not found on table '${rootTable.name}'`
        );
        const keyRows = await fetchRowsForKeys(ctx, rootTable, pkColumn, missingKeys, selection);
        for (const row of keyRows) {
          const pkValue = row[pkName];
          if (pkValue === undefined || pkValue === null) continue;
          const entity = entityByPk.get(pkValue);
          if (!entity) continue;
          const fkValue = row[relation.foreignKey];
          if (fkValue !== undefined && fkValue !== null) {
            entity[relation.foreignKey] = fkValue;
          }
        }
        foreignKeys = getForeignKeys();
      }
    }
  }

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
