import { TableDef } from '../../schema/table.js';
import { MorphOneRelation } from '../../schema/relation.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
import { RelationIncludeOptions } from '../../query-builder/relation-types.js';
import { EntityContext } from '../entity-context.js';
import { eq, and, ExpressionNode } from '../../core/ast/expression.js';
import {
  buildColumnSelection,
  collectKeysFromRoots,
  fetchRowsForKeys,
  filterRow,
  groupRowsByUnique,
  hasColumns
} from './shared.js';

export const loadMorphOneRelation = async (
  ctx: EntityContext,
  rootTable: TableDef,
  relationName: string,
  relation: MorphOneRelation,
  options?: RelationIncludeOptions
): Promise<Map<string, Record<string, unknown>>> => {
  const localKey = relation.localKey || findPrimaryKey(rootTable);
  const roots = ctx.getEntitiesForTable(rootTable);
  const keys = collectKeysFromRoots(roots, localKey);

  if (!keys.size) {
    return new Map();
  }

  const fkColumn = relation.target.columns[relation.idField];
  if (!fkColumn) return new Map();

  const requestedColumns = hasColumns(options?.columns) ? [...options!.columns] : undefined;
  const targetPrimaryKey = findPrimaryKey(relation.target);
  const selectedColumns = requestedColumns ? [...requestedColumns] : Object.keys(relation.target.columns);
  if (!selectedColumns.includes(targetPrimaryKey)) {
    selectedColumns.push(targetPrimaryKey);
  }

  const queryColumns = new Set(selectedColumns);
  queryColumns.add(relation.idField);

  const selection = buildColumnSelection(
    relation.target,
    Array.from(queryColumns),
    column => `Column '${column}' not found on relation '${relationName}'`
  );

  // Add discriminator filter
  const typeColumn = relation.target.columns[relation.typeField];
  const discriminatorFilter: ExpressionNode = eq(
    typeColumn ?? { type: 'Column', table: relation.target.name, name: relation.typeField },
    { type: 'Literal', value: relation.typeValue }
  );
  const combinedFilter = options?.filter ? and(options.filter, discriminatorFilter) : discriminatorFilter;

  const rows = await fetchRowsForKeys(ctx, relation.target, fkColumn, keys, selection, combinedFilter);
  const grouped = groupRowsByUnique(rows, relation.idField);

  if (!requestedColumns) return grouped;

  const visibleColumns = new Set(selectedColumns);
  const filtered = new Map<string, Record<string, unknown>>();
  for (const [key, row] of grouped.entries()) {
    filtered.set(key, filterRow(row, visibleColumns));
  }
  return filtered;
};
