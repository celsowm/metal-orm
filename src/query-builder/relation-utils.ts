import { BelongsToManyRelation } from '../schema/relation.js';

/**
 * Builds a default set of pivot columns, excluding keys used for joins.
 */
export const buildDefaultPivotColumns = (
  rel: BelongsToManyRelation,
  pivotPk: string
): string[] => {
  const excluded = new Set([pivotPk, rel.pivotForeignKeyToRoot, rel.pivotForeignKeyToTarget]);
  return Object.keys(rel.pivotTable.columns).filter(col => !excluded.has(col));
};
