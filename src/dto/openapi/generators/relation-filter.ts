import type { TableDef } from '../../../schema/table.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import {
    RelationDef,
    BelongsToRelation,
    HasManyRelation,
    HasOneRelation,
    BelongsToManyRelation,
    RelationKinds
} from '../../../schema/relation.js';
import type { OpenApiSchema } from '../types.js';
import { columnToOpenApiSchema } from './column.js';
import { getColumnMap } from './base.js';

export function relationFilterToOpenApiSchema(
    relation: RelationDef,
    options?: {
        exclude?: string[];
        include?: string[];
    }
): OpenApiSchema {
    if (relation.type === RelationKinds.BelongsTo || relation.type === RelationKinds.HasOne) {
        return singleRelationFilterToOpenApiSchema((relation as BelongsToRelation | HasOneRelation).target, options);
    }

    if (relation.type === RelationKinds.HasMany || relation.type === RelationKinds.BelongsToMany) {
        return manyRelationFilterToOpenApiSchema((relation as HasManyRelation | BelongsToManyRelation).target, options);
    }

    return { type: 'object', properties: {} };
}

function singleRelationFilterToOpenApiSchema(
    target: TableDef | EntityConstructor,
    options?: { exclude?: string[]; include?: string[] }
): OpenApiSchema {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];

    for (const [key, col] of Object.entries(columns)) {
        if (options?.exclude?.includes(key)) {
            continue;
        }

        if (options?.include && !options.include.includes(key)) {
            continue;
        }

        properties[key] = columnToOpenApiSchema(col);

        if (col.notNull || col.primary) {
            required.push(key);
        }
    }

    return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
    };
}

function manyRelationFilterToOpenApiSchema(
    target: TableDef | EntityConstructor,
    options?: { exclude?: string[]; include?: string[] }
): OpenApiSchema {
    return {
        type: 'object',
        properties: {
            some: {
                type: 'object',
                description: 'Filter related records that match all conditions',
                properties: generateNestedProperties(target, options),
            },
            every: {
                type: 'object',
                description: 'Filter related records where all match conditions',
                properties: generateNestedProperties(target, options),
            },
            none: {
                type: 'object',
                description: 'Filter where no related records match',
                properties: generateNestedProperties(target, options),
            },
            isEmpty: {
                type: 'boolean',
                description: 'Filter where relation has no related records',
            },
            isNotEmpty: {
                type: 'boolean',
                description: 'Filter where relation has related records',
            },
        },
    };
}

function generateNestedProperties(
    target: TableDef | EntityConstructor,
    options?: { exclude?: string[]; include?: string[] }
): Record<string, OpenApiSchema> {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        if (options?.exclude?.includes(key)) {
            continue;
        }

        if (options?.include && !options.include.includes(key)) {
            continue;
        }

        properties[key] = columnToOpenApiSchema(col);
    }

    return properties;
}

export function whereInputWithRelationsToOpenApiSchema<T extends TableDef | EntityConstructor>(
    target: T,
    options?: {
        columnExclude?: string[];
        columnInclude?: string[];
        relationExclude?: string[];
        relationInclude?: string[];
        maxDepth?: number;
    }
): OpenApiSchema {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};
    const depth = options?.maxDepth ?? 3;

    for (const [key, col] of Object.entries(columns)) {
        if (options?.columnExclude?.includes(key)) {
            continue;
        }

        if (options?.columnInclude && !options.columnInclude.includes(key)) {
            continue;
        }

        properties[key] = columnToOpenApiSchema(col);
    }

    const tableDef = target as TableDef;
    if (tableDef.relations && depth > 0) {
        for (const [relationName, relation] of Object.entries(tableDef.relations)) {
            if (options?.relationExclude?.includes(relationName)) {
                continue;
            }

            if (options?.relationInclude && !options.relationInclude.includes(relationName)) {
                continue;
            }

            properties[relationName] = relationFilterToOpenApiSchema(relation, {
                exclude: options?.columnExclude,
                include: options?.columnInclude,
            });
        }
    }

    return {
        type: 'object',
        properties,
    };
}

export function nestedWhereInputToOpenApiSchema<T extends TableDef | EntityConstructor>(
    target: T,
    depth: number = 2
): OpenApiSchema {
    if (depth <= 0) {
        return { type: 'object', properties: {} };
    }

    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        properties[key] = columnToOpenApiSchema(col);
    }

    const tableDef = target as TableDef;
    if (tableDef.relations) {
        for (const [relationName, relation] of Object.entries(tableDef.relations)) {
            properties[relationName] = relationFilterToOpenApiSchema(relation);

            if (depth > 1) {
                if (relation.type === RelationKinds.BelongsTo || relation.type === RelationKinds.HasOne) {
                    properties[relationName] = singleRelationFilterToOpenApiSchema((relation as BelongsToRelation | HasOneRelation).target);
                } else if (relation.type === RelationKinds.HasMany || relation.type === RelationKinds.BelongsToMany) {
                    properties[relationName] = {
                        type: 'object',
                        properties: {
                            some: nestedWhereInputToOpenApiSchema((relation as HasManyRelation | BelongsToManyRelation).target, depth - 1),
                            every: nestedWhereInputToOpenApiSchema((relation as HasManyRelation | BelongsToManyRelation).target, depth - 1),
                        },
                    };
                }
            }
        }
    }

    return {
        type: 'object',
        properties,
    };
}
