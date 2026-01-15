import type { OpenApiSchema, OpenApiOperation, OpenApiDocumentInfo, ApiRouteDefinition, OpenApiDocument, OpenApiDialect, OpenApiType } from './types.js';

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

export function applyNullability(
  schema: OpenApiSchema,
  isNullable: boolean,
  dialect: OpenApiDialect
): OpenApiSchema {
  if (!isNullable) {
    const { nullable: _, ...clean } = schema;
    return clean;
  }

  if (dialect === 'openapi-3.0') {
    return { ...schema, nullable: true };
  }

  const type = schema.type;
  if (Array.isArray(type)) {
    if (!type.includes('null')) {
      const { nullable: _, ...clean } = schema;
      return { ...clean, type: [...type, 'null'] as OpenApiType[] };
    }
  } else if (type) {
    const { nullable: _, ...clean } = schema;
    return { ...clean, type: [type, 'null'] as OpenApiType[] };
  } else {
    const { nullable: _, ...clean } = schema;
    return { ...clean, type: ['null'] as OpenApiType[] };
  }

  const { nullable: _, ...clean } = schema;
  return clean;
}

export function isNullableColumn(col: { notNull?: boolean }): boolean {
  return !col.notNull;
}

export function getOpenApiVersionForDialect(dialect: OpenApiDialect): string {
  return dialect === 'openapi-3.0' ? '3.0.3' : '3.1.0';
}

export function generateOpenApiDocument(
  info: OpenApiDocumentInfo,
  routes: ApiRouteDefinition[],
  options?: {
    dialect?: OpenApiDialect;
    allowScalarEquals?: boolean;
  }
): OpenApiDocument {
  const dialect: OpenApiDialect = options?.dialect ?? 'openapi-3.1';
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    paths[route.path][route.method] = route.operation;
  }

  return {
    openapi: getOpenApiVersionForDialect(dialect),
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
  };
}
