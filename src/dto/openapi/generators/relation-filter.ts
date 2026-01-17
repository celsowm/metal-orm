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
import type { OpenApiSchema, OpenApiDialect } from '../types.js';
import { columnToFilterSchema } from './filter.js';
import { getColumnMap } from './base.js';

export function relationFilterToOpenApiSchema(
    relation: RelationDef,
    options?: {
        exclude?: string[];
        include?: string[];
    },
    dialect: OpenApiDialect = 'openapi-3.1',
    depth: number = 0
): OpenApiSchema {
    if (relation.type === RelationKinds.BelongsTo || relation.type === RelationKinds.HasOne) {
        return singleRelationFilterToOpenApiSchema(
            (relation as BelongsToRelation | HasOneRelation).target,
            options,
            dialect,
            depth
        );
    }

    if (relation.type === RelationKinds.HasMany || relation.type === RelationKinds.BelongsToMany) {
        return manyRelationFilterToOpenApiSchema(
            (relation as HasManyRelation | BelongsToManyRelation).target,
            options,
            dialect,
            depth
        );
    }

    return { type: 'object', properties: {} };
}

function singleRelationFilterToOpenApiSchema(
    target: TableDef | EntityConstructor,
    options?: { exclude?: string[]; include?: string[] },
    dialect: OpenApiDialect = 'openapi-3.1',
    depth: number = 0
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

        properties[key] = columnToFilterSchema(col, dialect);

        if (col.notNull || col.primary) {
            required.push(key);
        }
    }

    if (depth > 0) {
        const tableDef = target as TableDef;
        if (tableDef.relations) {
            for (const [relationName, relation] of Object.entries(tableDef.relations)) {
                properties[relationName] = relationFilterToOpenApiSchema(relation, undefined, dialect, depth - 1);
            }
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
    options?: { exclude?: string[]; include?: string[] },
    dialect: OpenApiDialect = 'openapi-3.1',
    depth: number = 0
): OpenApiSchema {
    const nestedSchema: OpenApiSchema = depth > 0
        ? nestedWhereInputToOpenApiSchema(target, depth, dialect)
        : {
            type: 'object',
            properties: generateNestedProperties(target, options, dialect),
        };

    return {
        type: 'object',
        properties: {
            some: {
                ...nestedSchema,
                description: 'Filter related records that match all conditions',
            },
            every: {
                ...nestedSchema,
                description: 'Filter related records where all match conditions',
            },
            none: {
                ...nestedSchema,
                description: 'Filter where no related records match',
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
    options?: { exclude?: string[]; include?: string[] },
    dialect: OpenApiDialect = 'openapi-3.1'
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

        properties[key] = columnToFilterSchema(col, dialect);
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
    },
    dialect: OpenApiDialect = 'openapi-3.1'
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

        properties[key] = columnToFilterSchema(col, dialect);
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
            }, dialect);
        }
    }

    return {
        type: 'object',
        properties,
    };
}

export function nestedWhereInputToOpenApiSchema<T extends TableDef | EntityConstructor>(
    target: T,
    depth: number = 2,
    dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
    if (depth <= 0) {
        return { type: 'object', properties: {} };
    }

    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        properties[key] = columnToFilterSchema(col, dialect);
    }

    const tableDef = target as TableDef;
    if (tableDef.relations) {
        for (const [relationName, relation] of Object.entries(tableDef.relations)) {
            properties[relationName] = relationFilterToOpenApiSchema(relation, undefined, dialect, depth - 1);
        }
    }

    return {
        type: 'object',
        properties,
    };
}
