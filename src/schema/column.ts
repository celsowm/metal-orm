export type ColumnType = 'INT' | 'VARCHAR' | 'JSON' | 'ENUM' | 'BOOLEAN';

export interface ColumnDef {
  name: string; // filled at runtime by defineTable
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  args?: any[]; // for varchar length etc
  table?: string; // Filled at runtime by defineTable
}

// Column Factory
export const col = {
  int: (): ColumnDef => ({ name: '', type: 'INT' }),
  varchar: (length: number): ColumnDef => ({ name: '', type: 'VARCHAR', args: [length] }),
  json: (): ColumnDef => ({ name: '', type: 'JSON' }),
  boolean: (): ColumnDef => ({ name: '', type: 'BOOLEAN' }),
  primaryKey: (def: ColumnDef): ColumnDef => ({ ...def, primary: true })
};