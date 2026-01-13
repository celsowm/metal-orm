import type { OpenApiSchema, OpenApiOperation, OpenApiDocumentInfo, ApiRouteDefinition, OpenApiDocument } from './types.js';

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

export function generateOpenApiDocument(
  info: OpenApiDocumentInfo,
  routes: ApiRouteDefinition[]
): OpenApiDocument {
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
