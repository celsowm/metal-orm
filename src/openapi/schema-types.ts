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
 * Schema generation options
 */
export interface SchemaOptions {
  /** Use selected columns only (from select/include) vs full entity */
  mode?: 'selected' | 'full';
  /** Include description from column comments */
  includeDescriptions?: boolean;
  /** Include enum values for enum columns */
  includeEnums?: boolean;
  /** Include column examples if available */
  includeExamples?: boolean;
  /** Format output for pretty printing (debugging) */
  pretty?: boolean;
  /** Maximum depth for relation recursion */
  maxDepth?: number;
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
