import type { TableDef } from '../schema/table.js';
import type { RelationDef } from '../schema/relation.js';
import type { HydrationPlan, HydrationRelationPlan } from '../core/hydration/types.js';
import type { ProjectionNode } from '../query-builder/select-query-state.js';

import type {
  OpenApiSchema,
  SchemaExtractionContext,
  OutputSchemaOptions,
  JsonSchemaProperty,
  JsonSchemaType
} from './schema-types.js';
import { mapColumnType, mapRelationType } from './type-mappers.js';
import { defaultAggregateFunctionMapperRegistry, defaultWindowFunctionMapperRegistry } from './function-mapper-registry.js';
import {
  buildCircularReferenceSchema,
  ensureComponentRef,
  hasComputedProjection,
  resolveComponentName,
  resolveSelectedComponentName,
  shouldUseSelectedSchema
} from './schema-extractor-utils.js';

/**
 * Output schema extraction (query results)
 */
export const extractOutputSchema = (
  table: TableDef,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined,
  context: SchemaExtractionContext,
  options: OutputSchemaOptions
): OpenApiSchema => {
  const hasComputedFields = hasComputedProjection(projectionNodes);

  if (hasComputedFields) {
    return extractFromProjectionNodes(table, projectionNodes!, context, options);
  }

  if (shouldUseSelectedSchema(options, plan, projectionNodes)) {
    return extractSelectedSchema(table, plan, context, options);
  }

  return extractFullTableSchema(table, context, options);
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
  const mapper = defaultAggregateFunctionMapperRegistry.getOrDefault(
    functionName,
    (includeDesc: boolean): JsonSchemaProperty => ({
      type: 'string' as JsonSchemaType,
      nullable: true,
      ...(includeDesc ? { description: `Unknown function: ${functionName}` } : {}),
    })
  );

  return mapper(includeDescriptions);
};

/**
 * Maps SQL window functions to OpenAPI types
 */
const mapWindowFunctionToSchema = (
  functionName: string,
  includeDescriptions: boolean
): JsonSchemaProperty => {
  const mapper = defaultWindowFunctionMapperRegistry.getOrDefault(
    functionName,
    (includeDesc: boolean): JsonSchemaProperty => ({
      type: 'string' as JsonSchemaType,
      nullable: true,
      ...(includeDesc ? { description: `Unknown window function: ${functionName}` } : {}),
    })
  );

  return mapper(includeDescriptions);
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

  if (options.refMode === 'components' && context.components) {
    if (relationPlan && selectedColumns.length > 0 && options.selectedRefMode === 'components') {
      const plan: HydrationPlan = {
        rootTable: targetTable.name,
        rootPrimaryKey: relationPlan.targetPrimaryKey,
        rootColumns: selectedColumns,
        relations: []
      };
      const componentName = resolveSelectedComponentName(targetTable, plan, options);
      const ref = ensureComponentRef(
        targetTable,
        componentName,
        context,
        () => extractSelectedSchema(targetTable, plan, context, options)
      );

      if (relationType === 'array') {
        return {
          type: 'array',
          items: ref,
          nullable: isNullable
        };
      }

      return {
        ...ref,
        nullable: isNullable
      };
    }

    const componentName = resolveComponentName(targetTable, options);
    const ref = ensureComponentRef(
      targetTable,
      componentName,
      context,
      () => extractFullTableSchema(targetTable, context, options)
    );

    if (relationType === 'array') {
      return {
        type: 'array',
        items: ref,
        nullable: isNullable
      };
    }

    return {
      ...ref,
      nullable: isNullable
    };
  }

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
