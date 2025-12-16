import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';

/**
 * Build a typed selection map from a TableDef.
 * @template TTable - The table definition type
 * @template K - The column name keys
 * @param table - The table definition to select columns from
 * @param cols - Column names to include in the selection
 * @returns A typed record mapping column names to their definitions
 * @throws Error if a specified column is not found on the table
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

type Ctor<T> = { new(...args: unknown[]): T };

/**
 * Build a typed selection map from an entity constructor.
 * @template TEntity - The entity type
 * @template K - The property name keys
 * @param entity - The entity constructor to get table definition from
 * @param props - Property names to include in the selection
 * @returns A record mapping property names to their column definitions
 * @throws Error if no table definition is registered for the entity
 * @throws Error if a specified property is not found as a column
 */
export function esel<TEntity extends object, K extends keyof TEntity & string>(
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
