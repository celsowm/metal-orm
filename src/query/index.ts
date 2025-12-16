import { TableDef } from '../schema/table.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { InsertQueryBuilder } from '../query-builder/insert.js';
import { UpdateQueryBuilder } from '../query-builder/update.js';
import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { QueryTarget, resolveTable } from './target.js';

export const selectFrom = <TTable extends TableDef>(target: QueryTarget<TTable>): SelectQueryBuilder<unknown, TTable> => {
    const table = resolveTable(target);
    return new SelectQueryBuilder(table);
};

export const insertInto = <TTable extends TableDef>(target: QueryTarget<TTable>): InsertQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new InsertQueryBuilder(table);
};

export const update = <TTable extends TableDef>(target: QueryTarget<TTable>): UpdateQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new UpdateQueryBuilder(table);
};

export const deleteFrom = <TTable extends TableDef>(target: QueryTarget<TTable>): DeleteQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new DeleteQueryBuilder(table);
};
