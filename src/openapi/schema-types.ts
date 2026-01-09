/**
 * OpenAPI 3.1 JSON Schema type representation
 */
export type JsonSchemaType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'object' 
  | 'array' 
  | 'null';

/**
 * Common OpenAPI 3.1 JSON Schema formats
 */
export type JsonSchemaFormat = 
  | 'date-time' 
  | 'date' 
  | 'time' 
  | 'email' 
  | 'uuid' 
  | 'uri' 
  | 'binary' 
  | 'base64';

/**
 * OpenAPI 3.1 JSON Schema property definition
 */
export interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  format?: JsonSchemaFormat;
  description?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  example?: unknown;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
  $ref?: string;
  anyOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  oneOf?: JsonSchemaProperty[];
  [key: string]: unknown;
}

/**
 * Complete OpenAPI 3.1 Schema for an entity or query result
 */
export interface OpenApiSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  description?: string;
}

/**
 * Column-level schema flags
 */
export interface ColumnSchemaOptions {
  /** Include description from column comments */
  includeDescriptions?: boolean;
  /** Include enum values for enum columns */
  includeEnums?: boolean;
  /** Include column examples if available */
  includeExamples?: boolean;
  /** Include column defaults */
  includeDefaults?: boolean;
  /** Include nullable flag when applicable */
  includeNullable?: boolean;
}

/**
 * Output schema generation options (query result)
 */
export interface OutputSchemaOptions extends ColumnSchemaOptions {
  /** Use selected columns only (from select/include) vs full entity */
  mode?: 'selected' | 'full';
  /** Maximum depth for relation recursion */
  maxDepth?: number;
}

export type InputRelationMode = 'ids' | 'objects' | 'mixed';
export type InputSchemaMode = 'create' | 'update';

/**
 * Input schema generation options (write payloads)
 */
export interface InputSchemaOptions extends ColumnSchemaOptions {
  /** Create vs update payload shape */
  mode?: InputSchemaMode;
  /** Include relation payloads */
  includeRelations?: boolean;
  /** How relations are represented (ids, nested objects, or both) */
  relationMode?: InputRelationMode;
  /** Maximum depth for relation recursion */
  maxDepth?: number;
  /** Omit read-only/generated columns from input */
  omitReadOnly?: boolean;
  /** Exclude primary key columns from input */
  excludePrimaryKey?: boolean;
  /** Require primary key columns on update payloads */
  requirePrimaryKey?: boolean;
}

/**
 * Schema generation options
 */
export interface SchemaOptions extends OutputSchemaOptions {
  /** Input schema options, or false to skip input generation */
  input?: InputSchemaOptions | false;
}

/**
 * Input + output schema bundle
 */
export interface OpenApiSchemaBundle {
  output: OpenApiSchema;
  input?: OpenApiSchema;
}

/**
 * Schema extraction context for handling circular references
 */
export interface SchemaExtractionContext {
  /** Set of already visited tables to detect cycles */
  visitedTables: Set<string>;
  /** Map of table names to their generated schemas */
  schemaCache: Map<string, OpenApiSchema>;
  /** Current extraction depth */
  depth: number;
  /** Maximum depth to recurse */
  maxDepth: number;
}
