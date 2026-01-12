import type { TableDef } from '../../../schema/table.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type {
    RelationDef,
    BelongsToRelation,
    HasManyRelation,
    HasOneRelation,
    BelongsToManyRelation
} from '../../../schema/relation.js';
import type { OpenApiSchema, OpenApiComponent } from '../types.js';
import { columnToOpenApiSchema } from './column.js';
import { getColumnMap } from './base.js';
import { RelationKinds } from '../../../schema/relation.js';

export interface ComponentOptions {
    prefix?: string;
    exclude?: string[];
    include?: string[];
}

export interface NestedDtoOptions {
    maxDepth?: number;
    includeRelations?: boolean;
    componentOptions?: ComponentOptions;
}

export interface ComponentReference {
    $ref: string;
}

export function isComponentReference(schema: OpenApiSchema): schema is ComponentReference {
    return '$ref' in schema;
}

export function nestedDtoToOpenApiSchema<T extends TableDef | EntityConstructor>(
    target: T,
    options?: NestedDtoOptions
): OpenApiSchema {
    const depth = options?.maxDepth ?? 2;
    const includeRelations = options?.includeRelations ?? true;

    return nestedDtoSchema(target, depth, includeRelations, options?.componentOptions);
}

function nestedDtoSchema(
    target: TableDef | EntityConstructor,
    depth: number,
    includeRelations: boolean,
    componentOptions?: ComponentOptions
): OpenApiSchema {
    if (depth <= 0) {
        return { type: 'object', properties: {} };
    }

    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        if (componentOptions?.exclude?.includes(key)) {
            continue;
        }

        if (componentOptions?.include && !componentOptions.include.includes(key)) {
            continue;
        }

        properties[key] = columnToOpenApiSchema(col);
    }

    const tableDef = target as TableDef;
    if (includeRelations && tableDef.relations) {
        for (const [relationName, relation] of Object.entries(tableDef.relations)) {
            if (componentOptions?.exclude?.includes(relationName)) {
                continue;
            }

            if (componentOptions?.include && !componentOptions.include.includes(relationName)) {
                continue;
            }

            properties[relationName] = nestedRelationSchema(relation, depth - 1, componentOptions);
        }
    }

    return {
        type: 'object',
        properties,
    };
}

function nestedRelationSchema(
    relation: RelationDef,
    depth: number,
    componentOptions?: ComponentOptions
): OpenApiSchema {
    if (depth <= 0) {
        return { type: 'object', properties: {} };
    }

    if (relation.type === RelationKinds.BelongsTo || relation.type === RelationKinds.HasOne) {
        const target = (relation as BelongsToRelation | HasOneRelation).target;
        return nestedDtoSchema(target, depth, true, componentOptions);
    }

    if (relation.type === RelationKinds.HasMany || relation.type === RelationKinds.BelongsToMany) {
        const target = (relation as HasManyRelation | BelongsToManyRelation).target;
        return {
            type: 'array',
            items: nestedDtoSchema(target, depth - 1, true, componentOptions),
        };
    }

    return { type: 'object', properties: {} };
}

export function updateDtoWithRelationsToOpenApiSchema<T extends TableDef | EntityConstructor>(
    target: T,
    _options?: NestedDtoOptions
): OpenApiSchema {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        if (col.autoIncrement || col.generated) {
            continue;
        }

        properties[key] = {
            ...columnToOpenApiSchema(col),
            nullable: true,
        };
    }

    const tableDef = target as TableDef;
    if (_options?.includeRelations !== false && tableDef.relations) {
        for (const [relationName, relation] of Object.entries(tableDef.relations)) {
            if (relation.type === RelationKinds.BelongsTo || relation.type === RelationKinds.HasOne) {
                properties[relationName] = updateDtoToOpenApiSchemaForComponent(
                    (relation as BelongsToRelation | HasOneRelation).target
                );
            }
        }
    }

    return {
        type: 'object',
        properties,
    };
}

function updateDtoToOpenApiSchemaForComponent(
    target: TableDef | EntityConstructor
): OpenApiSchema {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        if (col.autoIncrement || col.generated) {
            continue;
        }

        properties[key] = {
            ...columnToOpenApiSchema(col),
            nullable: true,
        };
    }

    return {
        type: 'object',
        properties,
    };
}

export function generateComponentSchemas(
    targets: Array<{ name: string; table: TableDef | EntityConstructor }>,
    options?: ComponentOptions
): Record<string, OpenApiSchema> {
    const components: Record<string, OpenApiSchema> = {};
    const prefix = options?.prefix ?? '';

    for (const target of targets) {
        const componentName = `${prefix}${target.name}`;
        components[componentName] = dtoToOpenApiSchemaForComponent(
            target.table,
            options
        );
    }

    return components;
}

function dtoToOpenApiSchemaForComponent(
    target: TableDef | EntityConstructor,
    options?: ComponentOptions
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

export function generateRelationComponents(
    tables: Array<{ name: string; table: TableDef }>,
    options?: ComponentOptions
): Record<string, OpenApiSchema> {
    const components: Record<string, OpenApiSchema> = {};
    const prefix = options?.prefix ?? '';

    for (const { name, table } of tables) {
        const baseName = `${prefix}${name}`;
        components[`${baseName}Create`] = createDtoToOpenApiSchemaForComponent(table);
        components[`${baseName}Update`] = updateDtoToOpenApiSchemaForComponent(table);
        components[`${baseName}Filter`] = whereInputWithRelationsToOpenApiSchema(table, {
            columnExclude: options?.exclude,
            columnInclude: options?.include,
            maxDepth: 2,
        });
    }

    return components;
}

function createDtoToOpenApiSchemaForComponent(
    target: TableDef | EntityConstructor
): OpenApiSchema {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        if (col.autoIncrement || col.generated) {
            continue;
        }

        properties[key] = columnToOpenApiSchema(col);
    }

    return {
        type: 'object',
        properties,
    };
}

function whereInputWithRelationsToOpenApiSchema(
    target: TableDef | EntityConstructor,
    options?: {
        columnExclude?: string[];
        columnInclude?: string[];
        relationExclude?: string[];
        relationInclude?: string[];
        maxDepth?: number;
        prefix?: string;
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

function relationFilterToOpenApiSchema(
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
        return manyRelationFilterToOpenApiSchema((relation as HasManyRelation | BelongsToManyRelation).target);
    }

    return { type: 'object', properties: {} };
}

function singleRelationFilterToOpenApiSchema(
    target: TableDef | EntityConstructor,
    options?: { exclude?: string[]; include?: string[] }
): OpenApiSchema {
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

    return {
        type: 'object',
        properties,
    };
}

function manyRelationFilterToOpenApiSchema(
    target: TableDef | EntityConstructor
): OpenApiSchema {
    return {
        type: 'object',
        properties: {
            some: {
                type: 'object',
                description: 'Filter related records that match all conditions',
                properties: generateNestedProperties(target),
            },
            every: {
                type: 'object',
                description: 'Filter related records where all match conditions',
                properties: generateNestedProperties(target),
            },
            none: {
                type: 'object',
                description: 'Filter where no related records match',
                properties: generateNestedProperties(target),
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
    target: TableDef | EntityConstructor
): Record<string, OpenApiSchema> {
    const columns = getColumnMap(target);
    const properties: Record<string, OpenApiSchema> = {};

    for (const [key, col] of Object.entries(columns)) {
        properties[key] = columnToOpenApiSchema(col);
    }

    return properties;
}

export function createApiComponentsSection(
    schemas: Record<string, OpenApiSchema>,
    parameters?: Record<string, OpenApiSchema>,
    responses?: Record<string, OpenApiSchema>
): OpenApiComponent {
    const component: OpenApiComponent = {};

    if (Object.keys(schemas).length > 0) {
        component.schemas = schemas;
    }

    if (parameters && Object.keys(parameters).length > 0) {
        component.parameters = parameters;
    }

    if (responses && Object.keys(responses).length > 0) {
        component.responses = responses;
    }

    return component;
}

export function createRef(path: string): ComponentReference {
    return { $ref: `#/components/${path}` };
}

export function schemaToRef(schemaName: string): ComponentReference {
    return createRef(`schemas/${schemaName}`);
}

export function parameterToRef(paramName: string): ComponentReference {
    return createRef(`parameters/${paramName}`);
}

export function responseToRef(responseName: string): ComponentReference {
    return createRef(`responses/${responseName}`);
}

export function replaceWithRefs(
    schema: OpenApiSchema,
    schemaMap: Record<string, OpenApiSchema>,
    path: string = 'components/schemas'
): OpenApiSchema {
    if (typeof schema === 'object' && schema !== null) {
        if ('$ref' in schema) {
            return schema;
        }

        const schemaJson = JSON.stringify(schema);
        for (const [name, mapSchema] of Object.entries(schemaMap)) {
            if (JSON.stringify(mapSchema) === schemaJson) {
                return { $ref: `#/${path}/${name}` };
            }
        }

        if ('type' in schema && schema.type === 'object' && 'properties' in schema) {
            const newProperties: Record<string, OpenApiSchema> = {};

            for (const [key, value] of Object.entries(schema.properties || {})) {
                newProperties[key] = replaceWithRefs(value as OpenApiSchema, schemaMap, path);
            }

            return {
                ...schema,
                properties: newProperties,
            };
        }

        if ('items' in schema && typeof schema.items === 'object') {
            return {
                ...schema,
                items: replaceWithRefs(schema.items, schemaMap, path),
            };
        }

        if ('allOf' in schema && Array.isArray(schema.allOf)) {
            return {
                ...schema,
                allOf: schema.allOf.map(item => replaceWithRefs(item, schemaMap, path)),
            };
        }

        if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
            return {
                ...schema,
                oneOf: schema.oneOf.map(item => replaceWithRefs(item, schemaMap, path)),
            };
        }
    }

    return schema;
}

export function extractReusableSchemas(
    schema: OpenApiSchema,
    existing: Record<string, OpenApiSchema> = {},
    prefix: string = ''
): Record<string, OpenApiSchema> {
    if (typeof schema !== 'object' || schema === null) {
        return existing;
    }

    if ('type' in schema && schema.type === 'object' && 'properties' in schema) {
        for (const [key, value] of Object.entries(schema.properties || {})) {
            extractReusableSchemas(value as OpenApiSchema, existing, `${prefix}${key.charAt(0).toUpperCase() + key.slice(1)}`);
        }
    } else if ('items' in schema && typeof schema.items === 'object') {
        extractReusableSchemas(schema.items as OpenApiSchema, existing, prefix);
    } else if ('allOf' in schema && Array.isArray(schema.allOf)) {
        for (const item of schema.allOf) {
            extractReusableSchemas(item, existing, prefix);
        }
    } else if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
        for (const item of schema.oneOf) {
            extractReusableSchemas(item, existing, prefix);
        }
    }

    if (!('$ref' in schema)) {
        const name = prefix;
        if (name && 'type' in schema && schema.type === 'object' && 'properties' in schema) {
            if (!(name in existing) && Object.keys(schema.properties || {}).length > 0) {
                existing[name] = { ...schema };
            }
        }
    }

    return existing;
}
