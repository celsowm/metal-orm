export type ColumnType = 'INT' | 'VARCHAR' | 'JSON' | 'ENUM';

// Adicionada a propriedade `notNull`
export interface ColumnDef<T extends ColumnType = ColumnType> {
    name: string;
    type: T;
    primary?: boolean;
    notNull?: boolean;
}

// Mapeia o tipo da coluna para um tipo TypeScript base
export type InferColumnType<T extends ColumnType> = T extends 'INT'
    ? number
    : T extends 'VARCHAR' | 'ENUM' // ENUM também é mapeado para string
    ? string
    : T extends 'JSON'
    ? unknown
    : never;

// Novo tipo helper para inferir o tipo final, incluindo nulidade
export type InferTypedColumn<C extends ColumnDef> =
    C['notNull'] extends true
        ? InferColumnType<C['type']>
        : InferColumnType<C['type']> | null;

export type TableDefInput = Record<string, ColumnDef>;

// TableDef agora usa InferTypedColumn para inferir o tipo da entidade
export type TableDef<T extends TableDefInput> = {
    readonly name: string;
    readonly columns: { [K in keyof T]: T[K] & { name: K } };
    readonly $: { [K in keyof T]: InferTypedColumn<T[K]> };
};

// `col` helpers atualizados com `notNull`
export const col = {
    int: (): ColumnDef<'INT'> => ({ name: '', type: 'INT' }),
    varchar: (_len: number): ColumnDef<'VARCHAR'> => ({ name: '', type: 'VARCHAR' }),
    json: (): ColumnDef<'JSON'> => ({ name: '', type: 'JSON' }),
    // Chaves primárias são implicitamente não nulas
    primaryKey: <T extends ColumnDef>(c: T) => ({ ...c, primary: true, notNull: true as const }),
    // Helper para adicionar a restrição `NOT NULL`
    notNull: <T extends ColumnDef>(c: T) => ({ ...c, notNull: true as const }),
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
        $: undefined as any,
    } as const;
};

// Tabela Users atualizada para usar `notNull`
export const Users = defineTable('users', {
    id: col.primaryKey(col.int()), // notNull é implícito
    name: col.notNull(col.varchar(255)),
    role: col.notNull(col.varchar(50)),
    settings: col.json(), // Permanece anulável por padrão
});

// Tabela Orders atualizada para usar `notNull`
export const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.notNull(col.int()),
    total: col.notNull(col.int()),
    created_at: col.varchar(50), // Permanece anulável por padrão
});

// Exemplo de como o tipo User será inferido agora
export type User = typeof Users['$'];
/*
Isto seria equivalente a:
type User = {
  id: number;
  name: string;
  role: string;
  settings: any | null; // <-- Nulidade inferida corretamente
};
*/
