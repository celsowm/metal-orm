/**
 * OpenAPI 3.1 Schema generation for DTOs.
 * Generates JSON Schema compliant with OpenAPI 3.1 specification.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';
import type { EntityConstructor } from '../orm/entity-metadata.js';
import { getEntityMetadata } from '../orm/entity-metadata.js';
import type { Dto, CreateDto, UpdateDto, PagedResponse } from './dto-types.js';
import type { WhereInput, SimpleWhereInput } from './filter-types.js';

// ─────────────────────────────────────────────────────────────────────────────
// OpenAPI 3.1 Type Mappings
// ─────────────────────────────────────────────────────────────────────────────

export type OpenApiType = 
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

export interface OpenApiSchema {
  type?: OpenApiType | OpenApiType[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: unknown[];
  format?: string;
  description?: string;
  example?: unknown;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenApiSchema;
  description?: string;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: {
      'application/json': {
        schema: OpenApiSchema;
      };
    };
  };
  responses?: Record<string, {
    description: string;
    content?: {
      'application/json': {
        schema: OpenApiSchema;
      };
    };
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Column Type to OpenAPI Type Mapping
// ─────────────────────────────────────────────────────────────────────────────

function columnTypeToOpenApiType(col: ColumnDef): OpenApiType {
  const normalizedType = col.type.toUpperCase();
  
  switch (normalizedType) {
    case 'INT':
    case 'INTEGER':
    case 'BIGINT':
      return 'integer';
    case 'DECIMAL':
    case 'FLOAT':
    case 'DOUBLE':
      return 'number';
    case 'BOOLEAN':
      return 'boolean';
    case 'JSON':
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    case 'UUID':
    case 'DATE':
    case 'DATETIME':
    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
    case 'BINARY':
    case 'VARBINARY':
    case 'BLOB':
    case 'ENUM':
      return 'string';
    default:
      return 'string';
  }
}

function columnTypeToOpenApiFormat(col: ColumnDef): string | undefined {
  const normalizedType = col.type.toUpperCase();
  
  switch (normalizedType) {
    case 'INT':
    case 'INTEGER':
      return 'int32';
    case 'BIGINT':
      return 'int64';
    case 'DECIMAL':
    case 'FLOAT':
    case 'DOUBLE':
      return 'double';
    case 'DATE':
      return 'date';
    case 'DATETIME':
    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
      return 'date-time';
    case 'UUID':
      return 'uuid';
    default:
      return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity column extraction
// ─────────────────────────────────────────────────────────────────────────────

function isTableDef<T>(target: TableDef | EntityConstructor): target is TableDef {
  return 'columns' in target && 'name' in target;
}

function getColumnMap(target: TableDef | EntityConstructor): Record<string, ColumnDef> {
  if (isTableDef(target)) {
    return target.columns;
  }
  // For Entity classes, extract from metadata
  const meta = getEntityMetadata(target);
  if (meta && meta.columns) {
    const columns: Record<string, ColumnDef> = {};
    for (const [key, def] of Object.entries(meta.columns)) {
      columns[key] = {
        ...def,
        name: key,
        table: meta.tableName
      } as ColumnDef;
    }
    return columns;
  }
  return {};
}

/**
 * Generates an OpenAPI 3.1 schema object for a column definition.
 */
export function columnToOpenApiSchema(col: ColumnDef): OpenApiSchema {
  const schema: OpenApiSchema = {
    type: columnTypeToOpenApiType(col),
    format: columnTypeToOpenApiFormat(col),
  };

  if (!col.notNull) {
    schema.nullable = true;
  }

  if (col.comment) {
    schema.description = col.comment;
  }

  if (col.type.toUpperCase() === 'ENUM' && col.args && Array.isArray(col.args) && col.args.every(v => typeof v === 'string')) {
    schema.enum = col.args as string[];
  }

  const args = col.args;
  if (args && args.length > 0) {
    if (col.type.toUpperCase() === 'VARCHAR' || col.type.toUpperCase() === 'CHAR') {
      const length = args[0] as number;
      if (length) {
        schema.example = 'a'.repeat(length);
      }
    }
  }

  return schema;
}

/**
 * Generates an OpenAPI 3.1 schema for a DTO response type.
 */
export function dtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[]
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const [key, col] of Object.entries(columns)) {
    if (exclude?.includes(key as TExclude)) {
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

/**
 * Generates an OpenAPI 3.1 schema for a CreateDto type.
 */
export function createDtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[]
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const [key, col] of Object.entries(columns)) {
    if (exclude?.includes(key as TExclude)) {
      continue;
    }

    if (col.autoIncrement || col.generated) {
      continue;
    }

    properties[key] = columnToOpenApiSchema(col);

    if (col.notNull && !col.default) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}

/**
 * Generates an OpenAPI 3.1 schema for an UpdateDto type.
 * All fields are optional for partial updates.
 */
export function updateDtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[]
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};

  for (const [key, col] of Object.entries(columns)) {
    if (exclude?.includes(key as TExclude)) {
      continue;
    }

    if (col.autoIncrement || col.generated) {
      continue;
    }

    properties[key] = {
      ...columnToOpenApiSchema(col),
      ...(!col.notNull ? { nullable: true } : {}),
    };
  }

  return {
    type: 'object',
    properties,
  };
}

/**
 * Generates an OpenAPI 3.1 schema for WhereInput filter type.
 */
export function whereInputToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};

  for (const [key, col] of Object.entries(columns)) {
    properties[key] = filterFieldToOpenApiSchema(col);
  }

  return {
    type: 'object',
    properties,
  };
}

/**
 * Generates an OpenAPI schema for a filter field based on column type.
 */
function filterFieldToOpenApiSchema(col: ColumnDef): OpenApiSchema {
  const normalizedType = col.type.toUpperCase();
  const baseType = columnTypeToOpenApiType(col);
  
  let filterProperties: Record<string, OpenApiSchema> = {};

  if (['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(normalizedType)) {
    filterProperties = {
      equals: { type: 'number' },
      not: { type: 'number' },
      in: { type: 'array', items: { type: 'number' } },
      notIn: { type: 'array', items: { type: 'number' } },
      lt: { type: 'number' },
      lte: { type: 'number' },
      gt: { type: 'number' },
      gte: { type: 'number' },
    };
  } else if (['BOOLEAN'].includes(normalizedType)) {
    filterProperties = {
      equals: { type: 'boolean' },
      not: { type: 'boolean' },
    };
  } else if (['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'].includes(normalizedType)) {
    filterProperties = {
      equals: { type: 'string', format: 'date-time' },
      not: { type: 'string', format: 'date-time' },
      in: { type: 'array', items: { type: 'string', format: 'date-time' } },
      notIn: { type: 'array', items: { type: 'string', format: 'date-time' } },
      lt: { type: 'string', format: 'date-time' },
      lte: { type: 'string', format: 'date-time' },
      gt: { type: 'string', format: 'date-time' },
      gte: { type: 'string', format: 'date-time' },
    };
  } else {
    filterProperties = {
      equals: { type: 'string' },
      not: { type: 'string' },
      in: { type: 'array', items: { type: 'string' } },
      notIn: { type: 'array', items: { type: 'string' } },
      contains: { type: 'string' },
      startsWith: { type: 'string' },
      endsWith: { type: 'string' },
      mode: { type: 'string', enum: ['default', 'insensitive'] },
    };
  }

  return {
    type: 'object',
    properties: filterProperties,
  };
}

/**
 * Generates an OpenAPI 3.1 schema for a paginated response.
 */
export function pagedResponseToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  itemSchema: OpenApiSchema
): OpenApiSchema {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema,
      },
      totalItems: {
        type: 'integer',
        format: 'int64',
        description: 'Total number of items matching the query',
      },
      page: {
        type: 'integer',
        format: 'int32',
        description: 'Current page number (1-based)',
      },
      pageSize: {
        type: 'integer',
        format: 'int32',
        description: 'Number of items per page',
      },
      totalPages: {
        type: 'integer',
        format: 'int32',
        description: 'Total number of pages',
      },
      hasNextPage: {
        type: 'boolean',
        description: 'Whether there are more pages after the current one',
      },
      hasPrevPage: {
        type: 'boolean',
        description: 'Whether there are pages before the current one',
      },
    },
    required: ['items', 'totalItems', 'page', 'pageSize', 'totalPages', 'hasNextPage', 'hasPrevPage'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameter Schemas
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const paginationParamsSchema: OpenApiSchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      format: 'int32',
      minimum: 1,
      default: 1,
      description: 'Page number (1-based)',
    },
    pageSize: {
      type: 'integer',
      format: 'int32',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Number of items per page',
    },
    sortBy: {
      type: 'string',
      description: 'Field name to sort by',
    },
    sortOrder: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'asc',
      description: 'Sort order',
    },
  },
};

export function toPaginationParams(): OpenApiParameter[] {
  return [
    {
      name: 'page',
      in: 'query',
      schema: paginationParamsSchema.properties?.page as OpenApiSchema,
      description: 'Page number (1-based)',
    },
    {
      name: 'pageSize',
      in: 'query',
      schema: paginationParamsSchema.properties?.pageSize as OpenApiSchema,
      description: 'Number of items per page (max 100)',
    },
    {
      name: 'sortBy',
      in: 'query',
      schema: paginationParamsSchema.properties?.sortBy as OpenApiSchema,
      description: 'Field name to sort by',
    },
    {
      name: 'sortOrder',
      in: 'query',
      schema: paginationParamsSchema.properties?.sortOrder as OpenApiSchema,
      description: 'Sort order (asc or desc)',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Full OpenAPI Document Generation
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenApiDocumentInfo {
  title: string;
  version: string;
  description?: string;
}

export interface ApiRouteDefinition {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  operation: OpenApiOperation;
}

export function generateOpenApiDocument(
  info: OpenApiDocumentInfo,
  routes: ApiRouteDefinition[]
): Record<string, unknown> {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    paths[route.path][route.method] = route.operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

export function schemaToJson(schema: OpenApiSchema): string {
  return JSON.stringify(schema, null, 2);
}

export function deepCloneSchema(schema: OpenApiSchema): OpenApiSchema {
  return JSON.parse(JSON.stringify(schema));
}

export function mergeSchemas(base: OpenApiSchema, override: Partial<OpenApiSchema>): OpenApiSchema {
  return {
    ...base,
    ...override,
    properties: {
      ...base.properties,
      ...(override.properties || {}),
    },
    required: override.required ?? base.required,
  };
}
