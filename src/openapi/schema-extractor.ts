import type { TableDef } from '../schema/table.js';
import type { RelationDef } from '../schema/relation.js';
import type { HydrationPlan, HydrationRelationPlan } from '../core/hydration/types.js';
import type { ProjectionNode } from '../query-builder/select-query-state.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';

import type {
  OpenApiSchema,
  OpenApiSchemaBundle,
  SchemaExtractionContext,
  SchemaOptions,
  OutputSchemaOptions,
  InputSchemaOptions,
  JsonSchemaProperty,
  JsonSchemaType
} from './schema-types.js';
import { mapColumnType, mapRelationType } from './type-mappers.js';

const DEFAULT_MAX_DEPTH = 5;

/**
 * Extracts OpenAPI 3.1 schemas for output and optional input payloads.
 */
export const extractSchema = (
  table: TableDef,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined,
  options: SchemaOptions = {}
): OpenApiSchemaBundle => {
  const outputOptions = resolveOutputOptions(options);
  const outputContext = createContext(outputOptions.maxDepth ?? DEFAULT_MAX_DEPTH);
  const output = extractOutputSchema(table, plan, projectionNodes, outputContext, outputOptions);

  const inputOptions = resolveInputOptions(options);
  if (!inputOptions) {
    return { output };
  }

  const inputContext = createContext(inputOptions.maxDepth ?? DEFAULT_MAX_DEPTH);
  const input = extractInputSchema(table, inputContext, inputOptions);

  return { output, input };
};

const resolveOutputOptions = (options: SchemaOptions): OutputSchemaOptions => ({
  mode: options.mode ?? 'full',
  includeDescriptions: options.includeDescriptions,
  includeEnums: options.includeEnums,
  includeExamples: options.includeExamples,
  includeDefaults: options.includeDefaults,
  includeNullable: options.includeNullable,
  maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH
});

const resolveInputOptions = (options: SchemaOptions): InputSchemaOptions | undefined => {
  if (options.input === false) return undefined;
  const input = options.input ?? {};
  const mode = input.mode ?? 'create';

  return {
    mode,
    includeRelations: input.includeRelations ?? true,
    relationMode: input.relationMode ?? 'mixed',
    includeDescriptions: input.includeDescriptions ?? options.includeDescriptions,
    includeEnums: input.includeEnums ?? options.includeEnums,
    includeExamples: input.includeExamples ?? options.includeExamples,
    includeDefaults: input.includeDefaults ?? options.includeDefaults,
    includeNullable: input.includeNullable ?? options.includeNullable,
    maxDepth: input.maxDepth ?? options.maxDepth ?? DEFAULT_MAX_DEPTH,
    omitReadOnly: input.omitReadOnly ?? true,
    excludePrimaryKey: input.excludePrimaryKey ?? false,
    requirePrimaryKey: input.requirePrimaryKey ?? (mode === 'update')
  };
};

const createContext = (maxDepth: number): SchemaExtractionContext => ({
  visitedTables: new Set(),
  schemaCache: new Map(),
  depth: 0,
  maxDepth
});

/**
 * Output schema extraction (query results)
 */
const extractOutputSchema = (
  table: TableDef,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined,
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): OpenApiSchema => {
  const mode = options.mode ?? 'full';

  const hasComputedFields = projectionNodes && projectionNodes.some(
    node => node.type !== 'Column'
  );

  if (hasComputedFields) {
    return extractFromProjectionNodes(table, projectionNodes!, context, options);
  }

  if (mode === 'selected' && plan) {
    return extractSelectedSchema(table, plan, context, options);
  }

  return extractFullTableSchema(table, context, options);
};

/**
 * Input schema extraction (write payloads)
 */
const extractInputSchema = (
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

/**
 * Extracts schema from projection nodes (handles computed fields)
 */
const extractFromProjectionNodes = (
  table: TableDef,
  projectionNodes: ProjectionNode[],
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): OpenApiSchema => {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  const includeDescriptions = Boolean(options.includeDescriptions);

  for (const node of projectionNodes) {
    if (!node || typeof node !== 'object') continue;

    const projection = node as { type: string; alias?: string; fn?: string; value?: unknown };
    const propertyName = projection.alias ?? '';

    if (!propertyName) continue;

    if (projection.type === 'Column') {
      const columnNode = node as { table: string; name: string };
      const column = table.columns[columnNode.name];
      if (!column) continue;

      const property = mapColumnType(column, options);
      properties[propertyName] = property;

      if (column.notNull || column.primary) {
        required.push(propertyName);
      }
    } else if (projection.type === 'Function' || projection.type === 'WindowFunction') {
      const fnNode = node as { fn?: string; name?: string };
      const functionName = fnNode.fn?.toUpperCase() ?? fnNode.name?.toUpperCase() ?? '';
      const propertySchema = projection.type === 'Function'
        ? mapFunctionNodeToSchema(functionName, includeDescriptions)
        : mapWindowFunctionToSchema(functionName, includeDescriptions);

      properties[propertyName] = propertySchema;

      const isCountFunction = functionName === 'COUNT';
      const isWindowRankFunction = functionName === 'ROW_NUMBER' || functionName === 'RANK';

      if (isCountFunction || isWindowRankFunction) {
        required.push(propertyName);
      }
    } else if (projection.type === 'CaseExpression') {
      const propertySchema: JsonSchemaProperty = {
        type: 'string' as JsonSchemaType,
        nullable: true
      };
      if (includeDescriptions) {
        propertySchema.description = 'Computed CASE expression';
      }
      properties[propertyName] = propertySchema;
    } else if (projection.type === 'ScalarSubquery') {
      const propertySchema: JsonSchemaProperty = {
        type: 'object' as JsonSchemaType,
        nullable: true
      };
      if (includeDescriptions) {
        propertySchema.description = 'Subquery result';
      }
      properties[propertyName] = propertySchema;
    } else if (projection.type === 'CastExpression') {
      const propertySchema: JsonSchemaProperty = {
        type: 'string' as JsonSchemaType,
        nullable: true
      };
      if (includeDescriptions) {
        propertySchema.description = 'CAST expression result';
      }
      properties[propertyName] = propertySchema;
    }
  }

  return {
    type: 'object',
    properties,
    required
  };
};

/**
 * Maps SQL aggregate functions to OpenAPI types
 */
const mapFunctionNodeToSchema = (
  functionName: string,
  includeDescriptions: boolean
): JsonSchemaProperty => {
  const upperName = functionName.toUpperCase();

  switch (upperName) {
    case 'COUNT':
    case 'SUM':
    case 'AVG':
    case 'MIN':
    case 'MAX':
      return withOptionalDescription({
        type: 'number' as JsonSchemaType,
        nullable: false
      }, includeDescriptions, `${upperName} aggregate function result`);

    case 'GROUP_CONCAT':
    case 'STRING_AGG':
    case 'ARRAY_AGG':
      return withOptionalDescription({
        type: 'string' as JsonSchemaType,
        nullable: true
      }, includeDescriptions, `${upperName} aggregate function result`);

    case 'JSON_ARRAYAGG':
    case 'JSON_OBJECTAGG':
      return withOptionalDescription({
        type: 'object' as JsonSchemaType,
        nullable: true
      }, includeDescriptions, `${upperName} aggregate function result`);

    default:
      return withOptionalDescription({
        type: 'string' as JsonSchemaType,
        nullable: true
      }, includeDescriptions, `Unknown function: ${functionName}`);
  }
};

/**
 * Maps SQL window functions to OpenAPI types
 */
const mapWindowFunctionToSchema = (
  functionName: string,
  includeDescriptions: boolean
): JsonSchemaProperty => {
  const upperName = functionName.toUpperCase();

  switch (upperName) {
    case 'ROW_NUMBER':
    case 'RANK':
    case 'DENSE_RANK':
    case 'NTILE':
      return withOptionalDescription({
        type: 'integer' as JsonSchemaType,
        nullable: false
      }, includeDescriptions, `${upperName} window function result`);

    case 'LAG':
    case 'LEAD':
    case 'FIRST_VALUE':
    case 'LAST_VALUE':
      return withOptionalDescription({
        type: 'string' as JsonSchemaType,
        nullable: true
      }, includeDescriptions, `${upperName} window function result`);

    default:
      return withOptionalDescription({
        type: 'string' as JsonSchemaType,
        nullable: true
      }, includeDescriptions, `Unknown window function: ${functionName}`);
  }
};

const withOptionalDescription = (
  schema: JsonSchemaProperty,
  includeDescriptions: boolean,
  description: string
): JsonSchemaProperty => {
  if (includeDescriptions) {
    return { ...schema, description };
  }
  return schema;
};

/**
 * Extracts schema with only selected columns and relations
 */
const extractSelectedSchema = (
  table: TableDef,
  plan: HydrationPlan,
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): OpenApiSchema => {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  plan.rootColumns.forEach(columnName => {
    const column = table.columns[columnName];
    if (!column) return;

    properties[columnName] = mapColumnType(column, options);

    if (column.notNull || column.primary) {
      required.push(columnName);
    }
  });

  plan.relations.forEach(relationPlan => {
    const relation = table.relations[relationPlan.name];
    if (!relation) return;

    const relationSchema = extractRelationSchema(
      relation,
      relationPlan,
      relationPlan.columns,
      context,
      options
    );

    properties[relationPlan.name] = relationSchema;

    const { isNullable } = mapRelationType(relation.type);
    if (!isNullable && relationPlan.name) {
      required.push(relationPlan.name);
    }
  });

  return {
    type: 'object',
    properties,
    required
  };
};

/**
 * Extracts full table schema (all columns, all relations)
 */
const extractFullTableSchema = (
  table: TableDef,
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): OpenApiSchema => {
  const cacheKey = table.name;

  if (context.schemaCache.has(cacheKey)) {
    return context.schemaCache.get(cacheKey)!;
  }

  if (context.visitedTables.has(cacheKey) && context.depth > 0) {
    return buildCircularReferenceSchema(table.name, 'output');
  }

  context.visitedTables.add(cacheKey);

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  Object.entries(table.columns).forEach(([columnName, column]) => {
    properties[columnName] = mapColumnType(column, options);

    if (column.notNull || column.primary) {
      required.push(columnName);
    }
  });

  Object.entries(table.relations).forEach(([relationName, relation]) => {
    if (context.depth >= context.maxDepth) {
      return;
    }

    const relationSchema = extractRelationSchema(
      relation,
      undefined,
      [],
      { ...context, depth: context.depth + 1 },
      options
    );

    properties[relationName] = relationSchema;

    const { isNullable } = mapRelationType(relation.type);
    if (!isNullable) {
      required.push(relationName);
    }
  });

  const schema: OpenApiSchema = {
    type: 'object',
    properties,
    required
  };

  context.schemaCache.set(cacheKey, schema);
  return schema;
};

/**
 * Extracts schema for a single relation
 */
const extractRelationSchema = (
  relation: RelationDef,
  relationPlan: HydrationRelationPlan | undefined,
  selectedColumns: string[],
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): JsonSchemaProperty => {
  const targetTable = relation.target;
  const { type: relationType, isNullable } = mapRelationType(relation.type);

  let targetSchema: OpenApiSchema;

  if (relationPlan && selectedColumns.length > 0) {
    const plan: HydrationPlan = {
      rootTable: targetTable.name,
      rootPrimaryKey: relationPlan.targetPrimaryKey,
      rootColumns: selectedColumns,
      relations: []
    };

    targetSchema = extractSelectedSchema(targetTable, plan, context, options);
  } else {
    targetSchema = extractFullTableSchema(targetTable, context, options);
  }

  if (relationType === 'array') {
    return {
      type: 'array',
      items: targetSchema as JsonSchemaProperty,
      nullable: isNullable
    };
  }

  return {
    type: 'object' as JsonSchemaType,
    properties: targetSchema.properties,
    required: targetSchema.required,
    nullable: isNullable,
    description: targetSchema.description
  };
};

const buildCircularReferenceSchema = (
  tableName: string,
  kind: 'input' | 'output'
): OpenApiSchema => ({
  type: 'object',
  properties: {
    _ref: {
      type: 'string' as JsonSchemaType,
      description: `Circular ${kind} reference to ${tableName}`
    }
  },
  required: []
});

/**
 * Converts a schema to a JSON string with optional pretty printing
 */
export const schemaToJson = (schema: OpenApiSchema, pretty = false): string => {
  return JSON.stringify(schema, null, pretty ? 2 : 0);
};
