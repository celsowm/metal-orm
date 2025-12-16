import { BelongsToManyRelation } from '../schema/relation.js';

/**
 * Builds a default set of pivot columns, excluding keys used for joins.
 * @param rel - The BelongsToMany relation definition
 * @param pivotPk - The primary key column name of the pivot table
 * @returns Array of column names that can be included in pivot table selections
 */
export const buildDefaultPivotColumns = (
  rel: BelongsToManyRelation,
  pivotPk: string
): string[] => {
  const excluded = new Set([pivotPk, rel.pivotForeignKeyToRoot, rel.pivotForeignKeyToTarget]);
  return Object.keys(rel.pivotTable.columns).filter(col => !excluded.has(col));
};
