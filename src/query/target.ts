import { TableDef } from '../schema/table.js';
import { isTableDef } from '../schema/table-guards.js';
import { EntityConstructor } from '../orm/entity-metadata.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';

/**
 * Represents a target for query operations, which can be either a table definition
 * or an entity constructor. This type allows flexible targeting of database tables
 * through either direct table definitions or entity classes decorated with ORM metadata.
 *
 * @template TTable - The table definition type, defaults to TableDef
 */
export type QueryTarget<TTable extends TableDef = TableDef> = TTable | EntityConstructor;

const resolveEntityTarget = <TTable extends TableDef>(ctor: EntityConstructor): TTable => {
    const table = getTableDefFromEntity(ctor);
    if (!table) {
        throw new Error(`Entity '${ctor.name}' is not registered with decorators`);
    }
    return table as TTable;
};

/**
 * Resolves a QueryTarget to its corresponding table definition.
 *
 * If the target is already a TableDef, it returns it directly.
 * If the target is an EntityConstructor, it retrieves the associated table definition
 * from the entity's metadata.
 *
 * @template TTable - The table definition type
 * @param target - The query target to resolve
 * @returns The resolved table definition
 * @throws Error if the entity constructor is not registered with decorators
 *
 * @example
 * ```typescript
 * const table = resolveTable(UserTable); // Returns UserTable directly
 * const table2 = resolveTable(UserEntity); // Returns table def from UserEntity metadata
 * ```
 */
export const resolveTable = <TTable extends TableDef>(target: QueryTarget<TTable>): TTable => {
    if (isTableDef(target)) {
        return target as TTable;
    }
    return resolveEntityTarget(target as EntityConstructor);
};
