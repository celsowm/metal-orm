import { QueryBuilder } from './builder';
import { TableDef } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

export function Timestamps<TBase extends Constructor<QueryBuilder<TableDef<any>, any>>>(Base: TBase) {
    return class extends Base {
        touch() {
            // Em uma implementação real, isso definiria `updated_at` para o tempo atual
            console.log('Touching timestamps...');
            return this;
        }
    };
}

export function SoftDeletes<TBase extends Constructor<QueryBuilder<TableDef<any>, any>>>(Base: TBase) {
    return class extends Base {
        withTrashed() {
            // Lógica para incluir itens "soft-deleted"
            console.log('Including trashed items...');
            return this;
        }

        onlyTrashed() {
            // Lógica para buscar apenas itens "soft-deleted"
            console.log('Fetching only trashed items...');
            return this;
        }
    };
}