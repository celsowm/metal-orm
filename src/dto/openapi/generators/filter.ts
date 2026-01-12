import type { TableDef } from '../../../schema/table.js';
import type { ColumnDef } from '../../../schema/column-types.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type { OpenApiSchema } from '../types.js';
import { columnTypeToOpenApiType } from '../type-mappings.js';
import { getColumnMap } from './base.js';

function filterFieldToOpenApiSchema(col: ColumnDef): OpenApiSchema {
  const normalizedType = col.type.toUpperCase();
  columnTypeToOpenApiType(col);
  
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
