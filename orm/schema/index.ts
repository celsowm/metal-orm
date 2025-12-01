export type ColumnType = 'INT' | 'VARCHAR' | 'JSON' | 'ENUM';

export interface ColumnDef {
    name: string;
    type: ColumnType;
    primary?: boolean;
}

export interface TableDef {
    name: string;
    columns: Record<string, ColumnDef>;
}

export const col = {
    int: (): ColumnDef => ({ name: '', type: 'INT' }),
    varchar: (len: number): ColumnDef => ({ name: '', type: 'VARCHAR' }),
    json: (): ColumnDef => ({ name: '', type: 'JSON' }),
    primaryKey: (c: ColumnDef) => ({ ...c, primary: true })
};

export const defineTable = (name: string, columns: Record<string, ColumnDef>) => {
    const colsWithNames = Object.entries(columns).reduce((acc, [k, v]) => {
        acc[k] = { ...v, name: k };
        return acc;
    }, {} as any);
    return { name, columns: colsWithNames };
};

export const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    role: col.varchar(50),
    settings: col.json()
});

export const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    total: col.int(),
    created_at: col.varchar(50)
});