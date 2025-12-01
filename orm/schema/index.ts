export type ColumnType = 'INT' | 'VARCHAR' | 'JSON' | 'ENUM';

export interface ColumnDef<T extends ColumnType = ColumnType> {
    name: string;
    type: T;
    primary?: boolean;
}

// Mapeia o tipo da coluna para um tipo TypeScript
export type InferColumnType<T extends ColumnType> = T extends 'INT'
    ? number
    : T extends 'VARCHAR'
    ? string
    : T extends 'JSON'
    ? any
    : never;

// Este será o tipo de base para uma definição de tabela, antes de ser processado pelo defineTable
export type TableDefInput = Record<string, ColumnDef>;

// Esta é a definição da tabela totalmente tipada
export type TableDef<T extends TableDefInput> = {
    readonly name: string;
    readonly columns: { [K in keyof T]: T[K] & { name: K } };
    // Esta propriedade será útil para inferir o tipo de entidade
    readonly $: { [K in keyof T]: InferColumnType<T[K]['type']> };
};

export const col = {
    int: (): ColumnDef<'INT'> => ({ name: '', type: 'INT' }),
    varchar: (_len: number): ColumnDef<'VARCHAR'> => ({ name: '', type: 'VARCHAR' }),
    json: (): ColumnDef<'JSON'> => ({ name: '', type: 'JSON' }),
    primaryKey: <T extends ColumnType>(c: ColumnDef<T>) => ({ ...c, primary: true }),
};

export const defineTable = <T extends TableDefInput>(
    name: string,
    columns: T
): TableDef<T> => {
    const colsWithNames = Object.entries(columns).reduce((acc, [k, v]) => {
        acc[k as keyof T] = { ...v, name: k };
        return acc;
    }, {} as { [K in keyof T]: T[K] & { name: K } });

    return {
        name,
        columns: colsWithNames,
        $: undefined as any, // Esta é uma propriedade fantasma para inferência de tipo
    } as const;
};

export const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    role: col.varchar(50),
    settings: col.json(),
});

export const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    total: col.int(),
    created_at: col.varchar(50),
});

// Exemplo de como obter o tipo de um usuário
export type User = typeof Users['$'];
// Isto seria equivalente a:
// type User = {
//   id: number;
//   name: string;
//   role: string;
//   settings: any;
// };