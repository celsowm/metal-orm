import type { ColumnDef } from '../schema/column-types.js';
import type { ColumnSchemaOptions, JsonSchemaProperty, JsonSchemaType, JsonSchemaFormat } from './schema-types.js';

/**
 * Maps SQL column types to OpenAPI JSON Schema types
 */
export const mapColumnType = (
  column: ColumnDef,
  options: ColumnSchemaOptions = {}
): JsonSchemaProperty => {
  const resolved = resolveColumnOptions(options);
  const sqlType = normalizeType(column.type);
  const baseSchema = mapSqlTypeToBaseSchema(sqlType, column);

  const schema: JsonSchemaProperty = {
    ...baseSchema,
  };

  if (resolved.includeDescriptions && column.comment) {
    schema.description = column.comment;
  }

  if (resolved.includeNullable) {
    schema.nullable = !column.notNull && !column.primary;
  }

  if ((sqlType === 'varchar' || sqlType === 'char') && column.args) {
    schema.maxLength = column.args[0] as number | undefined;
  }

  if ((sqlType === 'decimal' || sqlType === 'float') && column.args) {
    if (column.args.length >= 1) {
      schema.minimum = -(10 ** (column.args[0] as number));
    }
  }

  if (!resolved.includeEnums) {
    delete schema.enum;
  } else if (sqlType === 'enum' && column.args && column.args.length > 0) {
    schema.enum = column.args as (string | number | boolean)[];
  }

  if (resolved.includeDefaults && column.default !== undefined) {
    schema.default = column.default;
  }

  return schema;
};

const normalizeType = (type: string): string => {
  return type.toLowerCase();
};

const mapSqlTypeToBaseSchema = (
  sqlType: string,
  column: ColumnDef
): Omit<JsonSchemaProperty, 'nullable' | 'description'> => {
  const type = normalizeType(sqlType);

  const hasCustomTsType = column.tsType !== undefined;

  switch (type) {
    case 'int':
    case 'integer':
    case 'bigint':
      return {
        type: hasCustomTsType ? inferTypeFromTsType(column.tsType) : ('integer' as JsonSchemaType),
        format: type === 'bigint' ? 'int64' : 'int32',
        minimum: column.autoIncrement ? 1 : undefined,
      };

    case 'decimal':
    case 'float':
    case 'double':
      return {
        type: hasCustomTsType ? inferTypeFromTsType(column.tsType) : ('number' as JsonSchemaType),
      };

    case 'varchar':
      return {
        type: 'string' as JsonSchemaType,
        minLength: column.notNull ? 1 : undefined,
        maxLength: column.args?.[0] as number | undefined,
      };

    case 'text':
      return {
        type: 'string' as JsonSchemaType,
        minLength: column.notNull ? 1 : undefined,
      };

    case 'char':
      return {
        type: 'string' as JsonSchemaType,
        minLength: column.notNull ? column.args?.[0] as number || 1 : undefined,
        maxLength: column.args?.[0] as number,
      };

    case 'boolean':
      return {
        type: 'boolean' as JsonSchemaType,
      };

    case 'json':
      return {
        anyOf: [
          { type: 'object' as JsonSchemaType },
          { type: 'array' as JsonSchemaType },
        ],
      };

    case 'blob':
    case 'binary':
    case 'varbinary':
      return {
        type: 'string' as JsonSchemaType,
        format: 'base64' as JsonSchemaFormat,
      };

    case 'date':
      return {
        type: 'string' as JsonSchemaType,
        format: 'date' as JsonSchemaFormat,
      };

    case 'datetime':
    case 'timestamp':
      return {
        type: 'string' as JsonSchemaType,
        format: 'date-time' as JsonSchemaFormat,
      };

    case 'timestamptz':
      return {
        type: 'string' as JsonSchemaType,
        format: 'date-time' as JsonSchemaFormat,
      };

    case 'uuid':
      return {
        type: 'string' as JsonSchemaType,
        format: 'uuid' as JsonSchemaFormat,
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      };

    case 'enum':
      return {
        type: 'string' as JsonSchemaType,
        enum: (column.args as (string | number | boolean)[]) || [],
      };

    default:
      if (column.dialectTypes?.postgres && column.dialectTypes.postgres === 'bytea') {
        return {
          type: 'string' as JsonSchemaType,
          format: 'base64' as JsonSchemaFormat,
        };
      }

      return {
        type: 'string' as JsonSchemaType,
      };
  }
};

const inferTypeFromTsType = (tsType: unknown): JsonSchemaType => {
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

  return 'string' as JsonSchemaType;
};

const resolveColumnOptions = (options: ColumnSchemaOptions): Required<ColumnSchemaOptions> => ({
  includeDescriptions: options.includeDescriptions ?? false,
  includeEnums: options.includeEnums ?? true,
  includeExamples: options.includeExamples ?? false,
  includeDefaults: options.includeDefaults ?? true,
  includeNullable: options.includeNullable ?? true
});

/**
 * Maps relation type to array or single object
 */
export const mapRelationType = (
  relationType: string
): { type: 'object' | 'array'; isNullable: boolean } => {
  switch (relationType) {
    case 'HAS_MANY':
    case 'BELONGS_TO_MANY':
      return { type: 'array', isNullable: false };
    case 'HAS_ONE':
    case 'BELONGS_TO':
      return { type: 'object', isNullable: true };
    default:
      return { type: 'object', isNullable: true };
  }
};

/**
 * Gets the OpenAPI format for temporal columns
 */
export const getTemporalFormat = (sqlType: string): JsonSchemaFormat | undefined => {
  const type = normalizeType(sqlType);

  switch (type) {
    case 'date':
      return 'date' as JsonSchemaFormat;
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
      return 'date-time' as JsonSchemaFormat;
    default:
      return undefined;
  }
};
