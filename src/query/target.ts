import { TableDef } from '../schema/table.js';
import { EntityConstructor } from '../orm/entity-metadata.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';

type QueryTargetTable<T extends TableDef> = T;

export type QueryTarget<TTable extends TableDef = TableDef> = TTable | EntityConstructor;

const isTableDef = (value: unknown): value is TableDef => {
    return typeof value === 'object' && value !== null && 'columns' in (value as TableDef);
};

const resolveEntityTarget = <TTable extends TableDef>(ctor: EntityConstructor): TTable => {
    const table = getTableDefFromEntity(ctor);
    if (!table) {
        throw new Error(`Entity '${ctor.name}' is not registered with decorators`);
    }
    return table as TTable;
};

export const resolveTable = <TTable extends TableDef>(target: QueryTarget<TTable>): TTable => {
    if (isTableDef(target)) {
        return target as TTable;
    }
    return resolveEntityTarget(target as EntityConstructor);
};
