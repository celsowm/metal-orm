import type { TableDef } from '../../../schema/table.js';
import type { ColumnDef } from '../../../schema/column-types.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import { getEntityMetadata } from '../../../orm/entity-metadata.js';

export function isTableDef(target: TableDef | EntityConstructor): target is TableDef {
  return 'columns' in target && 'name' in target;
}

export function getColumnMap(target: TableDef | EntityConstructor): Record<string, ColumnDef> {
  if (isTableDef(target)) {
    return target.columns;
  }
  const meta = getEntityMetadata(target);
  if (meta && meta.columns) {
    const columns: Record<string, ColumnDef> = {};
    for (const [key, def] of Object.entries(meta.columns)) {
      columns[key] = {
        ...def as object,
        name: key,
        table: meta.tableName
      } as ColumnDef;
    }
    return columns;
  }
  return {};
}

export type TargetType<T extends TableDef | EntityConstructor> = T;
