import type { TableDef } from '../schema/table.js';
import type { RelationDef } from '../schema/relation.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';

import type {
  OpenApiSchema,
  SchemaExtractionContext,
  InputSchemaOptions,
  JsonSchemaProperty,
  JsonSchemaType
} from './schema-types.js';
import { mapColumnType, mapRelationType } from './type-mappers.js';
import { buildCircularReferenceSchema } from './schema-extractor-utils.js';

/**
 * Input schema extraction (write payloads)
 */
export const extractInputSchema = (
  table: TableDef,
  context: SchemaExtractionContext,
  options: InputSchemaOptions
): OpenApiSchema => {
  const cacheKey = `${table.name}:${options.mode ?? 'create'}`;

  if (context.schemaCache.has(cacheKey)) {
    return context.schemaCache.get(cacheKey)!;
  }

  if (context.visitedTables.has(cacheKey) && context.depth > 0) {
    return buildCircularReferenceSchema(table.name, 'input');
  }

  context.visitedTables.add(cacheKey);

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  const primaryKey = findPrimaryKey(table);

  for (const [columnName, column] of Object.entries(table.columns)) {
    const isPrimary = columnName === primaryKey || column.primary;
    if (options.excludePrimaryKey && isPrimary) continue;
    if (options.omitReadOnly && isReadOnlyColumn(column)) continue;

    properties[columnName] = mapColumnType(column, options);

    if (options.mode === 'create' && isRequiredForCreate(column)) {
      required.push(columnName);
    }

    if (options.mode === 'update' && options.requirePrimaryKey && isPrimary) {
      required.push(columnName);
    }
  }

  if (options.includeRelations && context.depth < context.maxDepth) {
    for (const [relationName, relation] of Object.entries(table.relations)) {
      properties[relationName] = extractInputRelationSchema(
        relation,
        { ...context, depth: context.depth + 1 },
        options
      );
    }
  }

  const schema: OpenApiSchema = {
    type: 'object',
    properties,
    required
  };

  context.schemaCache.set(cacheKey, schema);
  return schema;
};

const isReadOnlyColumn = (column: { autoIncrement?: boolean; generated?: string }): boolean =>
  Boolean(column.autoIncrement || column.generated === 'always');

const isRequiredForCreate = (column: { notNull?: boolean; primary?: boolean; default?: unknown; autoIncrement?: boolean; generated?: string }): boolean => {
  if (isReadOnlyColumn(column)) return false;
  if (column.default !== undefined) return false;
  return Boolean(column.notNull || column.primary);
};

const buildPrimaryKeySchema = (
  table: TableDef,
  options: InputSchemaOptions
): JsonSchemaProperty => {
  const primaryKey = findPrimaryKey(table);
  const column = table.columns[primaryKey];
  if (!column) {
    return {
      anyOf: [
        { type: 'string' as JsonSchemaType },
        { type: 'number' as JsonSchemaType },
        { type: 'integer' as JsonSchemaType }
      ]
    };
  }

  return mapColumnType(column, options);
};

const extractInputRelationSchema = (
  relation: RelationDef,
  context: SchemaExtractionContext,
  options: InputSchemaOptions
): JsonSchemaProperty => {
  const { type: relationType, isNullable } = mapRelationType(relation.type);
  const relationMode = options.relationMode ?? 'mixed';
  const allowIds = relationMode !== 'objects';
  const allowObjects = relationMode !== 'ids';

  const variants: JsonSchemaProperty[] = [];

  if (allowIds) {
    variants.push(buildPrimaryKeySchema(relation.target, options));
  }

  if (allowObjects) {
    const targetSchema = extractInputSchema(relation.target, context, options);
    variants.push(targetSchema as JsonSchemaProperty);
  }

  const itemSchema: JsonSchemaProperty =
    variants.length === 1 ? variants[0] : { anyOf: variants };

  if (relationType === 'array') {
    return {
      type: 'array',
      items: itemSchema,
      nullable: isNullable
    };
  }

  return {
    ...itemSchema,
    nullable: isNullable
  };
};
