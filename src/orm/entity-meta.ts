import { TableDef } from '../schema/table.js';
import { OrmContext } from './orm-context.js';
import { RelationMap } from '../schema/types.js';

export const ENTITY_META = Symbol('EntityMeta');

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export interface EntityMeta<TTable extends TableDef> {
  ctx: OrmContext;
  table: TTable;
  lazyRelations: (keyof RelationMap<TTable>)[];
  relationCache: Map<string, Promise<any>>;
  relationHydration: Map<string, Map<string, any>>;
  relationWrappers: Map<string, unknown>;
}

export const getHydrationRows = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: string,
  key: unknown
): Record<string, any>[] | undefined => {
  const map = meta.relationHydration.get(relationName);
  if (!map) return undefined;
  const rows = map.get(toKey(key));
  if (!rows) return undefined;
  return Array.isArray(rows) ? rows : undefined;
};

export const getHydrationRecord = <TTable extends TableDef>(
  meta: EntityMeta<TTable>,
  relationName: string,
  key: unknown
): Record<string, any> | undefined => {
  const map = meta.relationHydration.get(relationName);
  if (!map) return undefined;
  const value = map.get(toKey(key));
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export const getEntityMeta = <TTable extends TableDef>(entity: any): EntityMeta<TTable> | undefined => {
  if (!entity || typeof entity !== 'object') return undefined;
  return (entity as any)[ENTITY_META];
};

export const hasEntityMeta = (entity: any): entity is { [ENTITY_META]: EntityMeta<TableDef> } => {
  return Boolean(getEntityMeta(entity));
};
