import type { TableDef } from '../../../schema/table.js';
import type { ColumnDef } from '../../../schema/column-types.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type { OpenApiSchema, OpenApiDialect } from '../types.js';
import { columnTypeToOpenApiType, columnTypeToOpenApiFormat } from '../type-mappings.js';
import { getColumnMap } from './base.js';
import { applyNullability, isNullableColumn } from '../utilities.js';

function filterFieldToOpenApiSchema(col: ColumnDef): OpenApiSchema {
  const openApiType = columnTypeToOpenApiType(col);
  const openApiFormat = columnTypeToOpenApiFormat(col);

  const filterProperties: Record<string, OpenApiSchema> = {};

  filterProperties.equals = { type: openApiType, format: openApiFormat };
  filterProperties.not = { type: openApiType, format: openApiFormat };
  filterProperties.in = { type: 'array', items: { type: openApiType, format: openApiFormat } };
  filterProperties.notIn = { type: 'array', items: { type: openApiType, format: openApiFormat } };

  const normalizedType = col.type.toUpperCase();
  const isNumeric = ['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(normalizedType);
  const isDateOrTime = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'].includes(normalizedType);
  const isString = !isNumeric && !isDateOrTime && openApiType === 'string';

  if (isNumeric) {
    filterProperties.lt = { type: openApiType };
    filterProperties.lte = { type: openApiType };
    filterProperties.gt = { type: openApiType };
    filterProperties.gte = { type: openApiType };
  }

  if (isDateOrTime) {
    filterProperties.lt = { type: 'string', format: openApiFormat };
    filterProperties.lte = { type: 'string', format: openApiFormat };
    filterProperties.gt = { type: 'string', format: openApiFormat };
    filterProperties.gte = { type: 'string', format: openApiFormat };
  }

  if (isString) {
    filterProperties.contains = { type: 'string' };
    filterProperties.startsWith = { type: 'string' };
    filterProperties.endsWith = { type: 'string' };
    filterProperties.mode = { type: 'string', enum: ['default', 'insensitive'] };
  }

  return {
    type: 'object',
    properties: filterProperties,
  };
}

export function columnToFilterSchema(
  col: ColumnDef,
  dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
  const filterSchema = filterFieldToOpenApiSchema(col);
  const nullable = isNullableColumn(col);
  return applyNullability(filterSchema, nullable, dialect);
}

export function whereInputToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T,
  dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};

  for (const [key, col] of Object.entries(columns)) {
    properties[key] = columnToFilterSchema(col, dialect);
  }

  return {
    type: 'object',
    properties,
  };
}
