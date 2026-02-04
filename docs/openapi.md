# OpenAPI 3.1 Schema Generation

MetalORM provides comprehensive OpenAPI 3.1 schema generation from your table definitions. Generate documentation for your REST APIs automatically from your schema.

## Overview

The OpenAPI module (`metal-orm/dto/openapi`) converts table definitions into OpenAPI schemas for:

- **Response DTOs** - API response types
- **Request DTOs** - Create and update request bodies
- **Filter Types** - Query parameter filters
- **Pagination** - Pagination request/response schemas
- **Nested Relations** - Complex object graphs
- **Tree DTOs** - TreeNode, TreeNodeResult, threaded trees, and tree lists

## Core Types

```typescript
import type { OpenApiSchema, OpenApiOperation, OpenApiParameter, OpenApiDocument, ApiRouteDefinition } from 'metal-orm/dto/openapi';
```

### OpenApiSchema

The main schema type representing an OpenAPI schema object:

```typescript
interface OpenApiSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: unknown[];
  format?: string;
  description?: string;
  example?: unknown;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
}
```

## Column to OpenAPI Mapping

MetalORM automatically maps database column types to OpenAPI types:

| Database Type | OpenAPI Type | Format |
|---------------|--------------|--------|
| `INT`, `INTEGER` | `integer` | `int32` |
| `BIGINT` | `integer` | `int64` |
| `DECIMAL`, `FLOAT`, `DOUBLE` | `number` | `double` |
| `BOOLEAN` | `boolean` | - |
| `DATE` | `string` | `date` |
| `DATETIME`, `TIMESTAMP` | `string` | `date-time` |
| `UUID` | `string` | `uuid` |
| `VARCHAR`, `CHAR`, `TEXT` | `string` | - |
| `JSON` | `string` | - |
| `ENUM` | `string` | enum values |
| `BLOB`, `BINARY`, `VARBINARY`, `BYTEA` | `string` | `byte` |

## Generating DTO Schemas

### Response DTO Schema

Generate a response schema that excludes sensitive fields:

```typescript
import { dtoToOpenApiSchema } from 'metal-orm/dto/openapi';
import { usersTable } from './schema';

const userResponseSchema = dtoToOpenApiSchema(usersTable, ['passwordHash', 'refreshToken']);
```

**Result:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "integer", "format": "int32" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "email", "createdAt"]
}
```

### Create DTO Schema

Generate a schema for POST/PUT request bodies:

```typescript
import { createDtoToOpenApiSchema } from 'metal-orm/dto/openapi';
import { usersTable } from './schema';

const createUserSchema = createDtoToOpenApiSchema(usersTable);
```

Auto-increment and generated columns are excluded. Required fields are marked as required.

### Update DTO Schema

Generate a schema for PATCH request bodies with all fields optional:

```typescript
import { updateDtoToOpenApiSchema } from 'metal-orm/dto/openapi';
import { usersTable } from './schema';

const updateUserSchema = updateDtoToOpenApiSchema(usersTable);
```

All fields are nullable and optional.

## Generating Filter Schemas

### WhereInput Schema

Generate a filter schema with operators for each column:

```typescript
import { whereInputToOpenApiSchema } from 'metal-orm/dto/openapi';
import { usersTable } from './schema';

const filterSchema = whereInputToOpenApiSchema(usersTable);
```

**Example output:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "object",
      "properties": {
        "equals": { "type": "string" },
        "not": { "type": "string" },
        "in": { "type": "array", "items": { "type": "string" } },
        "notIn": { "type": "array", "items": { "type": "string" } },
        "contains": { "type": "string" },
        "startsWith": { "type": "string" },
        "endsWith": { "type": "string" },
        "mode": { "type": "string", "enum": ["default", "insensitive"] }
      }
    },
    "age": {
      "type": "object",
      "properties": {
        "equals": { "type": "number" },
        "not": { "type": "number" },
        "in": { "type": "array", "items": { "type": "number" } },
        "lt": { "type": "number" },
        "lte": { "type": "number" },
        "gt": { "type": "number" },
        "gte": { "type": "number" }
      }
    },
    "isActive": {
      "type": "object",
      "properties": {
        "equals": { "type": "boolean" },
        "not": { "type": "boolean" }
      }
    },
    "createdAt": {
      "type": "object",
      "properties": {
        "equals": { "type": "string", "format": "date-time" },
        "lt": { "type": "string", "format": "date-time" },
        "lte": { "type": "string", "format": "date-time" },
        "gt": { "type": "string", "format": "date-time" },
        "gte": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

## Generating Pagination Schemas

### Pagination Parameters

Get OpenAPI parameters for pagination:

```typescript
import { paginationParamsSchema, toPaginationParams } from 'metal-orm/dto/openapi';

const params = toPaginationParams();
```

Returns an array of OpenApiParameter objects for:
- `page` (query, integer)
- `pageSize` (query, integer)
- `sortBy` (query, string)
- `sortOrder` (query, enum: asc/desc)

### Paged Response Schema

Wrap any item schema in a paginated response structure:

```typescript
import { pagedResponseToOpenApiSchema } from 'metal-orm/dto/openapi';
import { dtoToOpenApiSchema } from 'metal-orm/dto/openapi';

const userSchema = dtoToOpenApiSchema(usersTable);
const pagedUserSchema = pagedResponseToOpenApiSchema(userSchema);
```

**Result:**
```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": { "type": "object", "properties": {...} }
    },
    "totalItems": { "type": "integer", "format": "int64" },
    "page": { "type": "integer", "format": "int32" },
    "pageSize": { "type": "integer", "format": "int32" },
    "totalPages": { "type": "integer", "format": "int32" },
    "hasNextPage": { "type": "boolean" },
    "hasPrevPage": { "type": "boolean" }
  },
  "required": ["items", "totalItems", "page", "pageSize", "totalPages", "hasNextPage", "hasPrevPage"]
}
```

## Nested Relations with DTOs

### Nested DTO Schema

Generate schemas with nested relations:

```typescript
import { nestedDtoToOpenApiSchema } from 'metal-orm/dto/openapi';
import { usersTable, postsTable } from './schema';

const schema = nestedDtoToOpenApiSchema(usersTable, {
  maxDepth: 2,
  includeRelations: true,
  componentOptions: {
    exclude: ['passwordHash']
  }
});
```

**Options:**
- `maxDepth`: Maximum nesting depth (default: 2)
- `includeRelations`: Include relation properties (default: true)
- `componentOptions.exclude`: Columns/relations to exclude
- `componentOptions.include`: Only include specified columns/relations

### Update with Relations

Generate update DTO schema with nested relations for BelongsTo/HasOne:

```typescript
import { updateDtoWithRelationsToOpenApiSchema } from 'metal-orm/dto/openapi';

const updateSchema = updateDtoWithRelationsToOpenApiSchema(usersTable, {
  includeRelations: true
});
```

## Tree Schemas

Generate OpenAPI schemas for tree DTOs and responses:

```typescript
import {
  treeNodeToOpenApiSchema,
  treeNodeResultToOpenApiSchema,
  threadedNodeToOpenApiSchema,
  treeListEntryToOpenApiSchema,
  generateTreeComponents
} from 'metal-orm/dto/openapi';
import { categoriesTable } from './schema';

// TreeNode<T> (entity + nested set metadata)
const treeNodeSchema = treeNodeToOpenApiSchema(categoriesTable, {
  exclude: ['lft', 'rght', 'depth'],
});

// TreeNodeResult<T> (TreeManager responses)
const nodeResultSchema = treeNodeResultToOpenApiSchema(categoriesTable, {
  parentKey: 'parentId',
});

// ThreadedNode<T> (recursive)
const threadedNodeSchema = threadedNodeToOpenApiSchema(categoriesTable, {
  componentName: 'CategoryTreeNode',
});

// TreeListEntry
const treeListEntrySchema = treeListEntryToOpenApiSchema({
  keyType: 'integer',
  valueType: 'string',
});

// Bundle all tree components for a resource
const treeComponents = generateTreeComponents(categoriesTable, 'Category');
```

## Filter Schemas with Relations

### WhereInput with Relations

Generate filter schemas that include relation filters:

```typescript
import { whereInputWithRelationsToOpenApiSchema } from 'metal-orm/dto/openapi';

const filterSchema = whereInputWithRelationsToOpenApiSchema(usersTable, {
  columnExclude: ['passwordHash'],
  relationInclude: ['posts'],
  maxDepth: 2
});
```

### Nested Where Input

Generate deeply nested filter schemas:

```typescript
import { nestedWhereInputToOpenApiSchema } from 'metal-orm/dto/openapi';

const nestedFilter = nestedWhereInputToOpenApiSchema(usersTable, 3);
```

## Generating Component Schemas

### Reusable Schemas

Generate reusable component schemas for large APIs:

```typescript
import { generateComponentSchemas, generateRelationComponents } from 'metal-orm/dto/openapi';

const schemas = generateComponentSchemas([
  { name: 'User', table: usersTable },
  { name: 'Post', table: postsTable }
], {
  prefix: '',
  exclude: ['passwordHash']
});
```

Returns:
```json
{
  "User": { "type": "object", "properties": {...} },
  "Post": { "type": "object", "properties": {...} }
}
```

### Relation Components

Generate Create/Update/Filter schemas for all relations:

```typescript
const relationComponents = generateRelationComponents([
  { name: 'User', table: usersTable },
  { name: 'Post', table: postsTable }
], {
  exclude: ['passwordHash']
});
```

Returns:
```json
{
  "UserCreate": {...},
  "UserUpdate": {...},
  "UserFilter": {...},
  "PostCreate": {...},
  "PostUpdate": {...},
  "PostFilter": {...}
}
```

## Component References

### Creating References

Generate $ref references to components:

```typescript
import { schemaToRef, parameterToRef, responseToRef, createRef } from 'metal-orm/dto/openapi';

const schemaRef = schemaToRef('User');
// → { "$ref": "#/components/schemas/User" }

const paramRef = parameterToRef('PaginationParams');
// → { "$ref": "#/components/parameters/PaginationParams" }

const responseRef = responseToRef('NotFound');
// → { "$ref": "#/components/responses/NotFound" }
```

### Replacing Schemas with References

Replace duplicate schemas with $ref references:

```typescript
import { replaceWithRefs } from 'metal-orm/dto/openapi';

const schema = replaceWithRefs(
  userSchema,
  componentSchemas,
  'components/schemas'
);
```

### Extracting Reusable Schemas

Extract reusable schemas from a complex schema:

```typescript
import { extractReusableSchemas } from 'metal-orm/dto/openapi';

const extracted = extractReusableSchemas(nestedSchema, {}, 'User');
```

## Generating OpenAPI Documents

### Complete Document

Generate a complete OpenAPI document:

```typescript
import { generateOpenApiDocument } from 'metal-orm/dto/openapi';
import { dtoToOpenApiSchema, whereInputToOpenApiSchema, pagedResponseToOpenApiSchema } from 'metal-orm/dto/openapi';

const userResponse = dtoToOpenApiSchema(usersTable, ['passwordHash']);
const userFilter = whereInputToOpenApiSchema(usersTable);
const pagedUserResponse = pagedResponseToOpenApiSchema(userResponse);

const document = generateOpenApiDocument({
  title: 'User API',
  version: '1.0.0',
  description: 'API for managing users'
}, [
  {
    path: '/users',
    method: 'get',
    operation: {
      summary: 'List users',
      description: 'Get a paginated list of users',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: pagedUserResponse
            }
          }
        }
      }
    }
  },
  {
    path: '/users',
    method: 'post',
    operation: {
      summary: 'Create user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: createDtoToOpenApiSchema(usersTable)
          }
        }
      },
      responses: {
        '201': {
          description: 'User created',
          content: {
            'application/json': {
              schema: userResponse
            }
          }
        }
      }
    }
  }
]);
```

**Result:**
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "User API",
    "version": "1.0.0",
    "description": "API for managing users"
  },
  "paths": {
    "/users": {
      "get": {...},
      "post": {...}
    }
  }
}
```

## Utility Functions

### Schema Utilities

```typescript
import { schemaToJson, deepCloneSchema, mergeSchemas } from 'metal-orm/dto/openapi';

const json = schemaToJson(schema);
const clone = deepCloneSchema(schema);
const merged = mergeSchemas(baseSchema, overrideSchema);
```

### Creating API Components Section

```typescript
import { createApiComponentsSection } from 'metal-orm/dto/openapi';

const components = createApiComponentsSection(
  schemas,     // Record<string, OpenApiSchema>
  parameters,  // Record<string, OpenApiSchema> | undefined
  responses    // Record<string, OpenApiSchema> | undefined
);
```

## Complete Example

```typescript
import {
  dtoToOpenApiSchema,
  createDtoToOpenApiSchema,
  updateDtoToOpenApiSchema,
  whereInputToOpenApiSchema,
  pagedResponseToOpenApiSchema,
  generateComponentSchemas,
  generateOpenApiDocument
} from 'metal-orm/dto/openapi';
import { usersTable, postsTable } from './schema';

const userResponse = dtoToOpenApiSchema(usersTable, ['passwordHash']);
const createUser = createDtoToOpenApiSchema(usersTable);
const updateUser = updateDtoToOpenApiSchema(usersTable);
const filterUser = whereInputToOpenApiSchema(usersTable);
const pagedUsers = pagedResponseToOpenApiSchema(userResponse);

const components = generateComponentSchemas([
  { name: 'User', table: usersTable },
  { name: 'Post', table: postsTable }
], { exclude: ['passwordHash'] });

const document = generateOpenApiDocument({
  title: 'My API',
  version: '1.0.0'
}, [
  {
    path: '/users',
    method: 'get',
    operation: {
      summary: 'List users',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': { schema: pagedUsers }
          }
        }
      }
    }
  },
  {
    path: '/users/{id}',
    method: 'get',
    operation: {
      summary: 'Get user by ID',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': { schema: userResponse }
          }
        }
      }
    }
  },
  {
    path: '/users',
    method: 'post',
    operation: {
      summary: 'Create user',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: createUser }
        }
      },
      responses: {
        '201': {
          description: 'Created',
          content: {
            'application/json': { schema: userResponse }
          }
        }
      }
    }
  },
  {
    path: '/users/{id}',
    method: 'patch',
    operation: {
      summary: 'Update user',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: updateUser }
        }
      },
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': { schema: userResponse }
          }
        }
      }
    }
  }
]);

console.log(JSON.stringify(document, null, 2));
```

## Module Exports

```typescript
// Types
export type { OpenApiSchema, OpenApiType, OpenApiParameter, OpenApiOperation, OpenApiDocumentInfo, ApiRouteDefinition, PaginationParams, OpenApiComponent };

// Generators
export { dtoToOpenApiSchema, createDtoToOpenApiSchema, updateDtoToOpenApiSchema };
export { whereInputToOpenApiSchema, whereInputWithRelationsToOpenApiSchema, nestedWhereInputToOpenApiSchema };
export { relationFilterToOpenApiSchema };
export { nestedDtoToOpenApiSchema, updateDtoWithRelationsToOpenApiSchema };
export { pagedResponseToOpenApiSchema, paginationParamsSchema, toPaginationParams };
export { generateComponentSchemas, generateRelationComponents };
export { treeNodeToOpenApiSchema, treeNodeResultToOpenApiSchema, threadedNodeToOpenApiSchema, treeListEntryToOpenApiSchema, generateTreeComponents };
export { columnToOpenApiSchema };

// Component utilities
export { createApiComponentsSection, createRef, schemaToRef, parameterToRef, responseToRef, replaceWithRefs, extractReusableSchemas };

// Document utilities
export { generateOpenApiDocument, schemaToJson, deepCloneSchema, mergeSchemas };

// Type mappings
export { columnTypeToOpenApiType, columnTypeToOpenApiFormat, TypeMappingService };
```
