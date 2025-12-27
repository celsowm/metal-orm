import { TableDef } from '../schema/table.js';
import { EntityConstructor, getAllEntityMetadata } from './entity-metadata.js';

/**
 * Reverse lookup registry: TableDef → EntityConstructor
 */
const tableToConstructor = new Map<TableDef, EntityConstructor>();

/**
 * Gets the entity constructor for a given table definition.
 * @param table - The table definition
 * @returns The entity constructor or undefined if not found
 */
export const getConstructorForTable = (table: TableDef): EntityConstructor | undefined => {
    if (!tableToConstructor.size) {
        rebuildRegistry();
    }
    return tableToConstructor.get(table);
};

/**
 * Rebuilds the registry from entity metadata.
 * Called automatically on first lookup or when metadata changes.
 */
export const rebuildRegistry = (): void => {
    tableToConstructor.clear();
    for (const meta of getAllEntityMetadata()) {
        if (meta.table) {
            tableToConstructor.set(meta.table, meta.target);
        }
    }
};

/**
 * Clears the entity registry.
 */
export const clearEntityRegistry = (): void => {
    tableToConstructor.clear();
};
