import type { TableDef, IndexDef } from '../../schema/table.js';

/**
 * Derives the name for an index based on the table and index definition.
 * @param table - The table definition.
 * @param index - The index definition.
 * @returns The derived index name.
 */
export const deriveIndexName = (table: TableDef, index: IndexDef): string => {
  const base = (index.columns ?? [])
    .map(col => (typeof col === 'string' ? col : col.column))
    .join('_');

  const suffix = index.unique ? 'uniq' : 'idx';
  return `${table.name}_${base}_${suffix}`;
};
