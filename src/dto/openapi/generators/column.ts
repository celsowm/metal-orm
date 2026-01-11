import type { ColumnDef } from '../../../schema/column-types.js';
import type { OpenApiSchema } from '../types.js';
import { columnTypeToOpenApiType, columnTypeToOpenApiFormat } from '../type-mappings.js';

export function columnToOpenApiSchema(col: ColumnDef): OpenApiSchema {
  const schema: OpenApiSchema = {
    type: columnTypeToOpenApiType(col),
    format: columnTypeToOpenApiFormat(col),
  };

  if (!col.notNull) {
    schema.nullable = true;
  }

  if (col.comment) {
    schema.description = col.comment;
  }

  if (col.type.toUpperCase() === 'ENUM' && col.args && Array.isArray(col.args) && col.args.every(v => typeof v === 'string')) {
    schema.enum = col.args as string[];
  }

  const args = col.args;
  if (args && args.length > 0) {
    if (col.type.toUpperCase() === 'VARCHAR' || col.type.toUpperCase() === 'CHAR') {
      const length = args[0] as number;
      if (length) {
        schema.example = 'a'.repeat(length);
      }
    }
  }

  return schema;
}
