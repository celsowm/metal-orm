import { TableDef } from '../schema/table.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import { InsertQueryBuilder } from '../query-builder/insert.js';
import { UpdateQueryBuilder } from '../query-builder/update.js';
import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { QueryTarget, resolveTable } from './target.js';

/**
 * Creates a SELECT query builder for the specified table or entity.
 *
 * @template TTable - The table definition type
 * @param target - The table definition or entity constructor to query from
 * @returns A new SelectQueryBuilder instance for building SELECT queries
 *
 * @example
 * ```typescript
 * const query = selectFrom(UserTable).select('id', 'name');
 * ```
 */
export const selectFrom = <TTable extends TableDef>(target: QueryTarget<TTable>): SelectQueryBuilder<unknown, TTable> => {
    const table = resolveTable(target);
    return new SelectQueryBuilder(table);
};

/**
 * Creates an INSERT query builder for the specified table or entity.
 *
 * @template TTable - The table definition type
 * @param target - The table definition or entity constructor to insert into
 * @returns A new InsertQueryBuilder instance for building INSERT queries
 *
 * @example
 * ```typescript
 * const query = insertInto(UserTable).values({ name: 'John', email: 'john@example.com' });
 * ```
 */
export const insertInto = <TTable extends TableDef>(target: QueryTarget<TTable>): InsertQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new InsertQueryBuilder(table);
};

/**
 * Creates an UPDATE query builder for the specified table or entity.
 *
 * @template TTable - The table definition type
 * @param target - The table definition or entity constructor to update
 * @returns A new UpdateQueryBuilder instance for building UPDATE queries
 *
 * @example
 * ```typescript
 * const query = update(UserTable).set({ name: 'Jane' }).where(eq(UserTable.id, 1));
 * ```
 */
export const update = <TTable extends TableDef>(target: QueryTarget<TTable>): UpdateQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new UpdateQueryBuilder(table);
};

/**
 * Creates a DELETE query builder for the specified table or entity.
 *
 * @template TTable - The table definition type
 * @param target - The table definition or entity constructor to delete from
 * @returns A new DeleteQueryBuilder instance for building DELETE queries
 *
 * @example
 * ```typescript
 * const query = deleteFrom(UserTable).where(eq(UserTable.id, 1));
 * ```
 */
export const deleteFrom = <TTable extends TableDef>(target: QueryTarget<TTable>): DeleteQueryBuilder<unknown> => {
    const table = resolveTable(target);
    return new DeleteQueryBuilder(table);
};
