import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';

/**
 * Build a typed selection map from a TableDef.
 */
export function sel<
  TTable extends TableDef,
  K extends keyof TTable['columns'] & string
>(table: TTable, ...cols: K[]): Record<K, TTable['columns'][K]> {
  const selection = {} as Record<K, TTable['columns'][K]>;

  for (const col of cols) {
    const def = table.columns[col] as TTable['columns'][K];
    if (!def) {
      throw new Error(`Column '${col}' not found on table '${table.name}'`);
    }
    selection[col] = def;
  }

  return selection;
}

type Ctor<T> = { new (...args: any[]): T };

/**
 * Build a typed selection map from an entity constructor.
 */
export function esel<TEntity, K extends keyof TEntity & string>(
  entity: Ctor<TEntity>,
  ...props: K[]
): Record<K, ColumnDef> {
  const table = getTableDefFromEntity(entity) as TableDef | undefined;
  if (!table) {
    throw new Error(`No table definition registered for entity '${entity.name}'`);
  }

  const selection = {} as Record<K, ColumnDef>;

  for (const prop of props) {
    const col = table.columns[prop];
    if (!col) {
      throw new Error(`No column '${prop}' found for entity '${entity.name}'`);
    }
    selection[prop] = col;
  }

  return selection;
}
