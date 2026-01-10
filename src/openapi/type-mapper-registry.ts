import type { ColumnDef } from '../schema/column-types.js';

import type { JsonSchemaProperty, JsonSchemaType, JsonSchemaFormat } from './schema-types.js';

export type SqlTypeMapper = (
  column: ColumnDef,
  sqlType: string
) => Omit<JsonSchemaProperty, 'nullable' | 'description'>;

export class SqlTypeMapperRegistry {
  private mappers = new Map<string, SqlTypeMapper>();

  register(sqlType: string, mapper: SqlTypeMapper): void {
    this.mappers.set(sqlType.toLowerCase(), mapper);
  }

  has(sqlType: string): boolean {
    return this.mappers.has(sqlType.toLowerCase());
  }

  get(sqlType: string): SqlTypeMapper | undefined {
    return this.mappers.get(sqlType.toLowerCase());
  }

  getOrDefault(sqlType: string, defaultMapper: SqlTypeMapper): SqlTypeMapper {
    return this.get(sqlType) ?? defaultMapper;
  }

  unregister(sqlType: string): void {
    this.mappers.delete(sqlType.toLowerCase());
  }

  clear(): void {
    this.mappers.clear();
  }
}

export const createDefaultSqlTypeMappers = (): Record<string, SqlTypeMapper> => ({
  int: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'integer' as JsonSchemaType,
    format: 'int32',
    minimum: column.autoIncrement ? 1 : undefined,
  }),
  integer: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'integer' as JsonSchemaType,
    format: 'int32',
    minimum: column.autoIncrement ? 1 : undefined,
  }),
  bigint: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'integer' as JsonSchemaType,
    format: 'int64',
    minimum: column.autoIncrement ? 1 : undefined,
  }),
  decimal: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'number' as JsonSchemaType,
  }),
  float: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'number' as JsonSchemaType,
  }),
  double: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: inferTypeFromTsType(column.tsType) ?? 'number' as JsonSchemaType,
  }),
  varchar: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    minLength: column.notNull ? 1 : undefined,
    maxLength: column.args?.[0] as number | undefined,
  }),
  text: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    minLength: column.notNull ? 1 : undefined,
  }),
  char: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    minLength: column.notNull ? column.args?.[0] as number || 1 : undefined,
    maxLength: column.args?.[0] as number,
  }),
  boolean: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'boolean' as JsonSchemaType,
  }),
  json: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    anyOf: [
      { type: 'object' as JsonSchemaType },
      { type: 'array' as JsonSchemaType },
    ],
  }),
  blob: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'base64' as JsonSchemaFormat,
  }),
  binary: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'base64' as JsonSchemaFormat,
  }),
  varbinary: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'base64' as JsonSchemaFormat,
  }),
  date: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'date' as JsonSchemaFormat,
  }),
  datetime: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'date-time' as JsonSchemaFormat,
  }),
  timestamp: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'date-time' as JsonSchemaFormat,
  }),
  timestamptz: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'date-time' as JsonSchemaFormat,
  }),
  uuid: (): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    format: 'uuid' as JsonSchemaFormat,
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  }),
  enum: (column: ColumnDef): Omit<JsonSchemaProperty, 'nullable' | 'description'> => ({
    type: 'string' as JsonSchemaType,
    enum: (column.args as (string | number | boolean)[]) || [],
  }),
});

export const defaultSqlTypeMapperRegistry = new SqlTypeMapperRegistry();

Object.entries(createDefaultSqlTypeMappers()).forEach(([sqlType, mapper]) => {
  defaultSqlTypeMapperRegistry.register(sqlType, mapper);
});

export const inferTypeFromTsType = (tsType: unknown): JsonSchemaType | null => {
  if (typeof tsType === 'string') {
    if (tsType === 'number') return 'number' as JsonSchemaType;
    if (tsType === 'string') return 'string' as JsonSchemaType;
    if (tsType === 'boolean') return 'boolean' as JsonSchemaType;
  }

  if (typeof tsType === 'function') {
    const typeStr = tsType.name?.toLowerCase();
    if (typeStr === 'number') return 'number' as JsonSchemaType;
    if (typeStr === 'string') return 'string' as JsonSchemaType;
    if (typeStr === 'boolean') return 'boolean' as JsonSchemaType;
    if (typeStr === 'array') return 'array' as JsonSchemaType;
    if (typeStr === 'object') return 'object' as JsonSchemaType;
  }

  return null;
};
