import type { TableDef } from '../../../schema/table.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type { OpenApiSchema, OpenApiDialect } from '../types.js';
import { columnToOpenApiSchema } from './column.js';
import { getColumnMap } from './base.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[],
  dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];

  for (const [key, col] of Object.entries(columns)) {
    if (exclude?.includes(key as TExclude)) {
      continue;
    }

    properties[key] = columnToOpenApiSchema(col, dialect);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[],
  dialect: OpenApiDialect = 'openapi-3.1'
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

    properties[key] = columnToOpenApiSchema(col, dialect);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateDtoToOpenApiSchema<T extends TableDef | EntityConstructor, TExclude extends keyof any>(
  target: T,
  exclude?: TExclude[],
  dialect: OpenApiDialect = 'openapi-3.1'
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

    properties[key] = columnToOpenApiSchema(col, dialect);
  }

  return {
    type: 'object',
    properties,
  };
}
