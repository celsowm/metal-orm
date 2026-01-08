import type { TableDef } from '../schema/table.js';
import type { RelationDef } from '../schema/relation.js';
import type { HydrationPlan, HydrationRelationPlan } from '../core/hydration/types.js';
import type { ProjectionNode } from '../query-builder/select-query-state.js';

import type { OpenApiSchema, SchemaExtractionContext, SchemaOptions, JsonSchemaProperty, JsonSchemaType } from './schema-types.js';
import { mapColumnType, mapRelationType } from './type-mappers.js';

/**
 * Extracts OpenAPI 3.1 schema from a query builder's hydration plan
 * @param table - Table definition
 * @param plan - Hydration plan from query builder
 * @param projectionNodes - Projection AST nodes (for computed fields)
 * @param options - Schema generation options
 * @returns OpenAPI 3.1 JSON Schema
 */
export const extractSchema = (
  table: TableDef,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined,
  options: SchemaOptions = {}
): OpenApiSchema => {
  const mode = options.mode ?? 'full';

  const context: SchemaExtractionContext = {
    visitedTables: new Set(),
    schemaCache: new Map(),
    depth: 0,
    maxDepth: options.maxDepth ?? 5,
  };

  // Detect if query contains computed fields (non-Column nodes)
  const hasComputedFields = projectionNodes && projectionNodes.some(
    node => node.type !== 'Column'
  );

  if (hasComputedFields) {
    // Use projection-based extraction for computed fields + relations
    return extractFromProjectionNodes(table, projectionNodes!, context, options);
  }

  if (mode === 'selected' && plan) {
    return extractSelectedSchema(table, plan, context, options);
  }

  return extractFullTableSchema(table, context, options);
};

/**
 * Extracts schema from projection nodes (handles computed fields)
 * @param table - Table definition
 * @param projectionNodes - Projection AST nodes
 * @param context - Schema extraction context
 * @param options - Schema generation options
 * @returns OpenAPI 3.1 JSON Schema
 */
const extractFromProjectionNodes = (
  table: TableDef,
  projectionNodes: ProjectionNode[],
  context: SchemaExtractionContext,
  options: SchemaOptions
): OpenApiSchema => {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const node of projectionNodes) {
    if (!node || typeof node !== 'object') continue;

    const projection = node as { type: string; alias?: string; fn?: string; value?: unknown };
    const propertyName = projection.alias ?? '';

    if (!propertyName) continue;

    if (projection.type === 'Column') {
      const columnNode = node as { table: string; name: string };
      const column = table.columns[columnNode.name];
      if (!column) continue;

      const property = mapColumnType(column);
      if (!property.description && options.includeDescriptions && column.comment) {
        property.description = column.comment;
      }

      properties[propertyName] = property;

      if (column.notNull || column.primary) {
        required.push(propertyName);
      }
    } else if (projection.type === 'Function' || projection.type === 'WindowFunction') {
      const fnNode = node as { fn?: string; name?: string };
      const functionName = fnNode.fn?.toUpperCase() ?? fnNode.name?.toUpperCase() ?? '';
      const propertySchema = projection.type === 'Function' 
        ? mapFunctionNodeToSchema(functionName)
        : mapWindowFunctionToSchema(functionName);
      
      properties[propertyName] = propertySchema;

      const isCountFunction = functionName === 'COUNT';
      const isWindowRankFunction = functionName === 'ROW_NUMBER' || functionName === 'RANK';
      
      if (isCountFunction || isWindowRankFunction) {
        required.push(propertyName);
      }
    } else if (projection.type === 'CaseExpression') {
      const propertySchema: JsonSchemaProperty = {
        type: 'string' as JsonSchemaType,
        description: 'Computed CASE expression',
        nullable: true,
      };
      properties[propertyName] = propertySchema;
    } else if (projection.type === 'ScalarSubquery') {
      const propertySchema: JsonSchemaProperty = {
        type: 'object' as JsonSchemaType,
        description: 'Subquery result',
        nullable: true,
      };
      properties[propertyName] = propertySchema;
    } else if (projection.type === 'CastExpression') {
      const propertySchema: JsonSchemaProperty = {
        type: 'string' as JsonSchemaType,
        description: 'CAST expression result',
        nullable: true,
      };
      properties[propertyName] = propertySchema;
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
};

/**
 * Maps SQL aggregate functions to OpenAPI types
 * @param functionName - SQL function name
 * @returns OpenAPI JSON Schema property
 */
const mapFunctionNodeToSchema = (functionName: string): JsonSchemaProperty => {
  const upperName = functionName.toUpperCase();

  switch (upperName) {
    case 'COUNT':
    case 'SUM':
    case 'AVG':
    case 'MIN':
    case 'MAX':
      return {
        type: 'number' as JsonSchemaType,
        description: `${upperName} aggregate function result`,
        nullable: false,
      };

    case 'GROUP_CONCAT':
    case 'STRING_AGG':
    case 'ARRAY_AGG':
      return {
        type: 'string' as JsonSchemaType,
        description: `${upperName} aggregate function result`,
        nullable: true,
      };

    case 'JSON_ARRAYAGG':
    case 'JSON_OBJECTAGG':
      return {
        type: 'object' as JsonSchemaType,
        description: `${upperName} aggregate function result`,
        nullable: true,
      };

    default:
      return {
        type: 'string' as JsonSchemaType,
        description: `Unknown function: ${functionName}`,
        nullable: true,
      };
  }
};

/**
 * Maps SQL window functions to OpenAPI types
 * @param functionName - SQL function name
 * @returns OpenAPI JSON Schema property
 */
const mapWindowFunctionToSchema = (functionName: string): JsonSchemaProperty => {
  const upperName = functionName.toUpperCase();

  switch (upperName) {
    case 'ROW_NUMBER':
    case 'RANK':
    case 'DENSE_RANK':
    case 'NTILE':
      return {
        type: 'integer' as JsonSchemaType,
        description: `${upperName} window function result`,
        nullable: false,
      };

    case 'LAG':
    case 'LEAD':
    case 'FIRST_VALUE':
    case 'LAST_VALUE':
      return {
        type: 'string' as JsonSchemaType,
        description: `${upperName} window function result`,
        nullable: true,
      };

    default:
      return {
        type: 'string' as JsonSchemaType,
        description: `Unknown window function: ${functionName}`,
        nullable: true,
      };
  }
};

/**
 * Extracts schema with only selected columns and relations
 * @param table - Table definition
 * @param plan - Hydration plan
 * @param context - Schema extraction context
 * @param options - Schema generation options
 * @returns OpenAPI 3.1 JSON Schema
 */
const extractSelectedSchema = (
  table: TableDef,
  plan: HydrationPlan,
  context: SchemaExtractionContext,
  options: SchemaOptions
): OpenApiSchema => {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  plan.rootColumns.forEach(columnName => {
    const column = table.columns[columnName];
    if (!column) return;

    const property = mapColumnType(column);
    if (!property.description && options.includeDescriptions && column.comment) {
      property.description = column.comment;
    }

    properties[columnName] = property;

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
    required,
  };
};

/**
 * Extracts full table schema (all columns, all relations)
 * @param table - Table definition
 * @param context - Schema extraction context
 * @param options - Schema generation options
 * @returns OpenAPI 3.1 JSON Schema
 */
const extractFullTableSchema = (
  table: TableDef,
  context: SchemaExtractionContext,
  options: SchemaOptions
): OpenApiSchema => {
  const cacheKey = table.name;

  if (context.schemaCache.has(cacheKey)) {
    return context.schemaCache.get(cacheKey)!;
  }

  if (context.visitedTables.has(cacheKey) && context.depth > 0) {
    return {
      type: 'object',
      properties: {
        _ref: {
          type: 'string' as JsonSchemaType,
          description: `Circular reference to ${table.name}`,
        },
      },
      required: [],
    };
  }

  context.visitedTables.add(cacheKey);

  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  Object.entries(table.columns).forEach(([columnName, column]) => {
    const property = mapColumnType(column);
    if (!property.description && options.includeDescriptions && column.comment) {
      property.description = column.comment;
    }

    properties[columnName] = property;

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
    required,
  };

  context.schemaCache.set(cacheKey, schema);
  return schema;
};

/**
 * Extracts schema for a single relation
 * @param relation - Relation definition
 * @param relationPlan - Hydration plan for relation
 * @param selectedColumns - Selected columns from relation
 * @param context - Schema extraction context
 * @param options - Schema generation options
 * @returns OpenAPI JSON Schema property for relation
 */
const extractRelationSchema = (
  relation: RelationDef,
  relationPlan: HydrationRelationPlan | undefined,
  selectedColumns: string[],
  context: SchemaExtractionContext,
  options: SchemaOptions
): JsonSchemaProperty => {
  const targetTable = relation.target;
  const { type: relationType, isNullable } = mapRelationType(relation.type);

  let targetSchema: OpenApiSchema;

  if (relationPlan && selectedColumns.length > 0) {
    const plan: HydrationPlan = {
      rootTable: targetTable.name,
      rootPrimaryKey: relationPlan.targetPrimaryKey,
      rootColumns: selectedColumns,
      relations: [],
    };

    targetSchema = extractSelectedSchema(targetTable, plan, context, options);
  } else {
    targetSchema = extractFullTableSchema(targetTable, context, options);
  }

  if (relationType === 'array') {
    return {
      type: 'array',
      items: targetSchema as JsonSchemaProperty,
      nullable: isNullable,
    };
  }

  return {
    type: 'object' as JsonSchemaType,
    properties: targetSchema.properties,
    required: targetSchema.required,
    nullable: isNullable,
    description: targetSchema.description,
  };
};

/**
 * Converts a schema to a JSON string with optional pretty printing
 * @param schema - OpenAPI schema
 * @param pretty - Whether to pretty print
 * @returns JSON string
 */
export const schemaToJson = (schema: OpenApiSchema, pretty = false): string => {
  return JSON.stringify(schema, null, pretty ? 2 : 0);
};
