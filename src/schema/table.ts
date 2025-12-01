import { ColumnDef } from './column';
import { RelationDef } from './relation';

export interface TableDef<T extends Record<string, ColumnDef> = Record<string, ColumnDef>> {
  name: string;
  columns: T;
  relations: Record<string, RelationDef>;
}

export const defineTable = <T extends Record<string, ColumnDef>>(
    name: string, 
    columns: T,
    relations: Record<string, RelationDef> = {}
): TableDef<T> => {
  // Runtime mutability to assign names to column definitions for convenience
  const colsWithNames = Object.entries(columns).reduce((acc, [key, def]) => {
    (acc as any)[key] = { ...def, name: key, table: name };
    return acc;
  }, {} as T);
  
  return { name, columns: colsWithNames, relations };
};