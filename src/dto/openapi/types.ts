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

export interface OpenApiParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenApiSchema;
  description?: string;
}

export interface OpenApiResponseObject {
  description: string;
  content?: {
    'application/json': {
      schema: OpenApiSchema;
    };
  };
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  parameters?: OpenApiParameterObject[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: {
      'application/json': {
        schema: OpenApiSchema;
      };
    };
  };
  responses?: Record<string, OpenApiResponseObject>;
}

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

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OpenApiComponent {
  schemas?: Record<string, OpenApiSchema>;
  parameters?: Record<string, OpenApiParameterObject>;
  responses?: Record<string, OpenApiResponseObject>;
  securitySchemes?: Record<string, unknown>;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiDocumentInfo;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: OpenApiComponent;
}

export type OpenApiDialect = 'openapi-3.0' | 'openapi-3.1';

export interface OpenApiDocumentOptions {
  dialect?: OpenApiDialect;
  allowScalarEquals?: boolean;
}

export type OpenApiParameter = OpenApiParameterObject;
