import type { OpenApiSchema, OpenApiParameter } from '../types.js';

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

export function pagedResponseToOpenApiSchema<T extends OpenApiSchema>(
  itemSchema: T
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
