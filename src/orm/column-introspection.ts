import { normalizeColumnType } from '../schema/column-types.js';
import type { ColumnType } from '../schema/column-types.js';
import type { TableDef } from '../schema/table.js';
import type { ColumnDefLike, EntityConstructor } from './entity-metadata.js';
import { getEntityMetadata } from './entity-metadata.js';

type ColumnTarget = TableDef | EntityConstructor;

const getColumnDefFromTarget = (
  target: ColumnTarget,
  column: string
): ColumnDefLike | undefined => {
  if (typeof target === 'function') {
    const meta = getEntityMetadata(target);
    if (!meta?.columns) return undefined;
    return meta.columns[column];
  }

  const table = target as TableDef;
  return table.columns[column];
};

export const getColumnType = (
  target: ColumnTarget,
  column: string
): ColumnType | undefined => {
  const col = getColumnDefFromTarget(target, column);
  if (!col?.type) return undefined;
  return normalizeColumnType(col.type);
};

export const getDateKind = (
  target: ColumnTarget,
  column: string
): 'date' | 'date-time' | undefined => {
  const type = getColumnType(target, column);
  if (!type) return undefined;
  if (type === 'date') return 'date';
  if (type === 'datetime' || type === 'timestamp' || type === 'timestamptz') {
    return 'date-time';
  }
  return undefined;
};
