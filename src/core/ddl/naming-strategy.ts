import type { TableDef, IndexDef } from '../../schema/table.js';

export const deriveIndexName = (table: TableDef, index: IndexDef): string => {
  const base = (index.columns ?? [])
    .map(col => (typeof col === 'string' ? col : col.column))
    .join('_');

  const suffix = index.unique ? 'uniq' : 'idx';
  return `${table.name}_${base}_${suffix}`;
};
