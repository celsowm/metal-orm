import type { ColumnDef } from '../../../schema/column-types.js';
import type { OpenApiSchema, OpenApiDialect } from '../types.js';
import { columnTypeToOpenApiType, columnTypeToOpenApiFormat } from '../type-mappings.js';
import { applyNullability, isNullableColumn } from '../utilities.js';

export function columnToOpenApiSchema(
  col: ColumnDef,
  dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
  const schema: OpenApiSchema = {
    type: columnTypeToOpenApiType(col),
    format: columnTypeToOpenApiFormat(col),
  };

  const nullable = isNullableColumn(col);
  const result = applyNullability(schema, nullable, dialect);

  if (col.comment) {
    result.description = col.comment;
  }

  if (col.type.toUpperCase() === 'ENUM' && col.args && Array.isArray(col.args) && col.args.every(v => typeof v === 'string')) {
    result.enum = col.args as string[];
  }

  const args = col.args;
  if (args && args.length > 0) {
    if (col.type.toUpperCase() === 'VARCHAR' || col.type.toUpperCase() === 'CHAR') {
      const length = args[0] as number;
      if (length) {
        result.example = 'a'.repeat(length);
      }
    }
  }

  return result;
}
