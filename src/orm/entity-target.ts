import { TableDef } from '../schema/table.js';
import {
    hasMany,
    hasOne,
    belongsTo,
    belongsToMany,
    RelationKinds,
    type RelationDef
} from '../schema/relation.js';
import {
    buildTableDef,
    EntityConstructor,
    EntityOrTableTarget,
    EntityOrTableTargetResolver,
    getAllEntityMetadata,
    getEntityMetadata,
    type RelationMetadata
} from './entity-metadata.js';

/**
 * Checks if a value is a valid TableDef object.
 * @param value The value to check
 * @returns Whether the value represents a valid table definition
 */
const isTableDef = (value: unknown): value is TableDef => {
    return typeof value === 'object' && value !== null && 'columns' in (value as TableDef);
};

/**
 * Unwraps complex target resolvers into concrete entity/table references.
 * Handles both direct references and factory functions.
 * @param target The target resolver (function or direct reference)
 * @returns Resolved entity or table definition
 */
const unwrapTarget = (target: EntityOrTableTargetResolver): EntityOrTableTarget => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    if (typeof target === 'function' && (target as Function).prototype === undefined) {
        return (target as () => EntityOrTableTarget)();
    }
    return target as EntityOrTableTarget;
};

/**
 * Resolves an entity/table target into a concrete TableDef instance.
 * @param target The entity constructor, table definition, or resolver function
 * @param tableMap Map of registered entities to their table definitions
 * @returns Concrete TableDef instance
 * @throws If the entity hasn't been properly registered
 */
const resolveTableTarget = (
    target: EntityOrTableTargetResolver,
    tableMap: Map<EntityConstructor, TableDef>
): TableDef => {
    const resolved = unwrapTarget(target);
    if (isTableDef(resolved)) {
        return resolved;
    }
    const table = tableMap.get(resolved as EntityConstructor);
    if (!table) {
        throw new Error(`Entity '${(resolved as EntityConstructor).name}' is not registered with decorators`);
    }
    return table;
};

/**
 * Constructs relation definitions from entity metadata.
 * Converts decorator-based relation configuration to runtime RelationDef objects.
 * @param meta Entity metadata containing relation configuration
 * @param tableMap Map of registered entity tables
 * @returns Record of fully formed relation definitions
 */
const buildRelationDefinitions = (
    meta: { relations: Record<string, RelationMetadata> },
    tableMap: Map<EntityConstructor, TableDef>
): Record<string, RelationDef> => {
    const relations: Record<string, RelationDef> = {};

    for (const [name, relation] of Object.entries(meta.relations)) {
        switch (relation.kind) {
            case RelationKinds.HasOne: {
                relations[name] = hasOne(
                    resolveTableTarget(relation.target, tableMap),
                    relation.foreignKey,
                    relation.localKey,
                    relation.cascade
                );
                break;
            }
            case RelationKinds.HasMany: {
                relations[name] = hasMany(
                    resolveTableTarget(relation.target, tableMap),
                    relation.foreignKey,
                    relation.localKey,
                    relation.cascade
                );
                break;
            }
            case RelationKinds.BelongsTo: {
                relations[name] = belongsTo(
                    resolveTableTarget(relation.target, tableMap),
                    relation.foreignKey,
                    relation.localKey,
                    relation.cascade
                );
                break;
            }
            case RelationKinds.BelongsToMany: {
                relations[name] = belongsToMany(
                    resolveTableTarget(relation.target, tableMap),
                    resolveTableTarget(relation.pivotTable, tableMap),
                    {
                        pivotForeignKeyToRoot: relation.pivotForeignKeyToRoot,
                        pivotForeignKeyToTarget: relation.pivotForeignKeyToTarget,
                        localKey: relation.localKey,
                        targetKey: relation.targetKey,
                        pivotPrimaryKey: relation.pivotPrimaryKey,
                        defaultPivotColumns: relation.defaultPivotColumns,
                        cascade: relation.cascade
                    }
                );
                break;
            }
        }
    }

    return relations;
};

/**
 * Initializes all registered entities and populates their table definitions.
 * This should be called once during application startup.
 * Creates table definitions, configures relations, and returns all table defs.
 * @returns Array of initialized TableDef instances
 */
export const bootstrapEntities = (): TableDef[] => {
    const metas = getAllEntityMetadata();
    const tableMap = new Map<EntityConstructor, TableDef>();

    for (const meta of metas) {
        const table = buildTableDef(meta);
        tableMap.set(meta.target, table);
    }

    for (const meta of metas) {
        const table = meta.table!;
        const relations = buildRelationDefinitions(meta, tableMap);
        table.relations = relations;
    }

    return metas.map(meta => meta.table!) as TableDef[];
};

/**
 * Retrieves the table definition for an entity class.
 * Bootstraps entity definitions if not already initialized.
 * @template TTable Type of the table definition
 * @param ctor Entity constructor function
 * @returns Table definition or undefined if not found
 */
export const getTableDefFromEntity = <TTable extends TableDef = TableDef>(
    ctor: EntityConstructor
): TTable | undefined => {
    const meta = getEntityMetadata(ctor);
    if (!meta) return undefined;
    if (!meta.table) {
        bootstrapEntities();
    }
    return meta.table as TTable;
};
