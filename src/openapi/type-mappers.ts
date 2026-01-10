import type { ColumnDef } from '../schema/column-types.js';
import type { ColumnSchemaOptions, JsonSchemaProperty, JsonSchemaFormat } from './schema-types.js';
import { defaultSqlTypeMapperRegistry } from './type-mapper-registry.js';

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

  const mapper = defaultSqlTypeMapperRegistry.get(type);

  if (mapper) {
    return mapper(column, type);
  }

  if (column.dialectTypes?.postgres && column.dialectTypes.postgres === 'bytea') {
    return {
      type: 'string',
      format: 'base64' as JsonSchemaFormat,
    };
  }

  return {
    type: 'string',
  };
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
