import type { TableDef } from '../../../schema/table.js';
import type { ColumnDef } from '../../../schema/column-types.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type { OpenApiSchema } from '../types.js';
import { columnToOpenApiSchema } from './column.js';
import { getColumnMap } from './base.js';

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
