/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { PrimaryKey, Entity, Column } from '../../src/index.js';
import type { Dto, CreateDto, UpdateDto } from '../../src/dto/index.js';
import {
  columnToOpenApiSchema,
  dtoToOpenApiSchema,
  createDtoToOpenApiSchema,
  updateDtoToOpenApiSchema,
  whereInputToOpenApiSchema,
  pagedResponseToOpenApiSchema,
  paginationParamsSchema,
  toPaginationParams,
  generateOpenApiDocument,
  schemaToJson,
  deepCloneSchema,
  mergeSchemas,
  type OpenApiSchema
} from '../../src/dto/openapi-schema.js';

@Entity()
class TestUser {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;

  @Column(col.notNull(col.varchar(255)))
  email!: string;

  @Column(col.varchar(255))
  passwordHash?: string;

  @Column(col.text())
  bio?: string;

  @Column(col.default(col.timestamp(), { raw: 'NOW()' }))
  createdAt?: string;
}

const usersTable = defineTable('users', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.varchar(100)),
  email: col.notNull(col.varchar(255)),
  passwordHash: col.varchar(255),
  bio: col.text(),
  createdAt: col.default(col.timestamp(), { raw: 'NOW()' }),
});

const postsTable = defineTable('posts', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  title: col.notNull(col.varchar(255)),
  content: col.text(),
  published: col.default(col.boolean(), false),
  authorId: col.notNull(col.int()),
});

describe('OpenAPI 3.1 Schema Generation', () => {
  describe('columnToOpenApiSchema', () => {
    it('maps integer column to integer type', () => {
      const schema = columnToOpenApiSchema(col.int());
      expect(schema.type).toBe('integer');
      expect(schema.format).toBe('int32');
    });

    it('maps bigint column to integer type with int64 format', () => {
      const schema = columnToOpenApiSchema(col.bigint());
      expect(schema.type).toBe('integer');
      expect(schema.format).toBe('int64');
    });

    it('maps varchar column to string type', () => {
      const schema = columnToOpenApiSchema(col.varchar(100));
      expect(schema.type).toBe('string');
    });

    it('maps text column to string type', () => {
      const schema = columnToOpenApiSchema(col.text());
      expect(schema.type).toBe('string');
    });

    it('maps boolean column to boolean type', () => {
      const schema = columnToOpenApiSchema(col.boolean());
      expect(schema.type).toBe('boolean');
    });

    it('maps decimal column to number type', () => {
      const schema = columnToOpenApiSchema(col.decimal(10, 2));
      expect(schema.type).toBe('number');
    });

    it('maps date column to string with date format', () => {
      const schema = columnToOpenApiSchema(col.date());
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('date');
    });

    it('maps timestamp column to string with date-time format', () => {
      const schema = columnToOpenApiSchema(col.timestamp());
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('date-time');
    });

    it('maps uuid column to string with uuid format', () => {
      const schema = columnToOpenApiSchema(col.uuid());
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('uuid');
    });

    it('maps json column to string type', () => {
      const schema = columnToOpenApiSchema(col.json());
      expect(schema.type).toBe('string');
    });

    it('maps enum column to string with enum values', () => {
      const schema = columnToOpenApiSchema(col.enum(['active', 'inactive', 'pending']));
      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('sets nullable when notNull is false', () => {
      const nullableCol = { ...col.varchar(100), notNull: false };
      const schema = columnToOpenApiSchema(nullableCol);
      expect(schema.nullable).toBe(true);
    });

    it('does not set nullable when notNull is true', () => {
      const notNullCol = { ...col.varchar(100), notNull: true };
      const schema = columnToOpenApiSchema(notNullCol);
      expect(schema.nullable).toBeUndefined();
    });

    it('includes description when comment is present', () => {
      const colWithComment = { ...col.varchar(100), comment: 'User display name' };
      const schema = columnToOpenApiSchema(colWithComment);
      expect(schema.description).toBe('User display name');
    });
  });

  describe('dtoToOpenApiSchema', () => {
    it('generates schema for response DTO with TableDef', () => {
      type UserResponse = Dto<typeof usersTable, 'passwordHash'>;
      const schema = dtoToOpenApiSchema(usersTable, ['passwordHash']);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.id).toBeDefined();
      expect(schema.properties!.name).toBeDefined();
      expect(schema.properties!.email).toBeDefined();
      expect(schema.properties!.passwordHash).toBeUndefined();
    });

    it('marks required fields correctly', () => {
      const schema = dtoToOpenApiSchema(usersTable);

      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      expect(schema.required).not.toContain('passwordHash');
      expect(schema.required).not.toContain('bio');
    });

    it('generates schema for response DTO with Entity class', () => {
      type UserResponse = Dto<typeof TestUser, 'passwordHash'>;
      const schema = dtoToOpenApiSchema(TestUser, ['passwordHash']);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.id).toBeDefined();
      expect(schema.properties!.name).toBeDefined();
      expect(schema.properties!.passwordHash).toBeUndefined();
    });

    it('excludes multiple fields when specified', () => {
      const schema = dtoToOpenApiSchema(usersTable, ['passwordHash', 'bio']);

      expect(schema.properties!.passwordHash).toBeUndefined();
      expect(schema.properties!.bio).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
    });

    it('generates correct field types', () => {
      const schema = dtoToOpenApiSchema(usersTable);

      expect(schema.properties!.id?.type).toBe('integer');
      expect(schema.properties!.name?.type).toBe('string');
      expect(schema.properties!.email?.type).toBe('string');
      expect(schema.properties!.bio?.type).toBe('string');
    });
  });

  describe('createDtoToOpenApiSchema', () => {
    it('excludes auto-generated fields', () => {
      const schema = createDtoToOpenApiSchema(usersTable);

      expect(schema.properties!.id).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
      expect(schema.properties!.email).toBeDefined();
    });

    it('marks required fields based on notNull constraint', () => {
      const schema = createDtoToOpenApiSchema(usersTable);

      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      expect(schema.required).not.toContain('bio');
      expect(schema.required).not.toContain('passwordHash');
    });

    it('handles Entity classes', () => {
      const schema = createDtoToOpenApiSchema(TestUser);

      expect(schema.properties!.id).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
    });

    it('excludes specified fields', () => {
      const schema = createDtoToOpenApiSchema(usersTable, ['email']);

      expect(schema.properties!.email).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
    });
  });

  describe('updateDtoToOpenApiSchema', () => {
    it('includes all fields as optional', () => {
      const schema = updateDtoToOpenApiSchema(usersTable);

      expect(schema.properties!.name).toBeDefined();
      expect(schema.properties!.email).toBeDefined();
      expect(schema.properties!.bio).toBeDefined();
      expect(schema.required).toBeUndefined();
    });

    it('excludes auto-generated fields', () => {
      const schema = updateDtoToOpenApiSchema(usersTable);

      expect(schema.properties!.id).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
    });

    it('sets nullable based on notNull constraint', () => {
      const schema = updateDtoToOpenApiSchema(usersTable);

      expect(schema.properties!.name?.nullable).toBeUndefined();
      expect(schema.properties!.bio?.nullable).toBe(true);
      expect(schema.properties!.passwordHash?.nullable).toBe(true);
    });

    it('excludes specified fields', () => {
      const schema = updateDtoToOpenApiSchema(usersTable, ['email']);

      expect(schema.properties!.email).toBeUndefined();
      expect(schema.properties!.name).toBeDefined();
    });
  });

  describe('whereInputToOpenApiSchema', () => {
    it('generates filter schema for all columns', () => {
      const schema = whereInputToOpenApiSchema(usersTable);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.name).toBeDefined();
      expect(schema.properties!.email).toBeDefined();
      expect(schema.properties!.id).toBeDefined();
    });

    it('generates numeric filter operators for integer columns', () => {
      const schema = whereInputToOpenApiSchema(usersTable);

      expect(schema.properties!.id?.type).toBe('object');
      expect(schema.properties!.id?.properties).toBeDefined();
      expect(schema.properties!.id?.properties!.equals?.type).toBe('number');
      expect(schema.properties!.id?.properties!.gt).toBeDefined();
      expect(schema.properties!.id?.properties!.lte).toBeDefined();
    });

    it('generates string filter operators for varchar columns', () => {
      const schema = whereInputToOpenApiSchema(usersTable);

      expect(schema.properties!.name?.type).toBe('object');
      expect(schema.properties!.name?.properties).toBeDefined();
      expect(schema.properties!.name?.properties!.contains?.type).toBe('string');
      expect(schema.properties!.name?.properties!.startsWith).toBeDefined();
      expect(schema.properties!.name?.properties!.endsWith).toBeDefined();
    });

    it('generates boolean filter operators for boolean columns', () => {
      const schema = whereInputToOpenApiSchema(postsTable);

      expect(schema.properties!.published?.type).toBe('object');
      expect(schema.properties!.published?.properties!.equals?.type).toBe('boolean');
      expect(schema.properties!.published?.properties!.not?.type).toBe('boolean');
    });

    it('generates date filter operators for timestamp columns', () => {
      const schema = whereInputToOpenApiSchema(usersTable);

      expect(schema.properties!.createdAt?.type).toBe('object');
      expect(schema.properties!.createdAt?.properties!.equals?.format).toBe('date-time');
      expect(schema.properties!.createdAt?.properties!.gte).toBeDefined();
      expect(schema.properties!.createdAt?.properties!.lt).toBeDefined();
    });
  });

  describe('pagedResponseToOpenApiSchema', () => {
    it('generates paginated response schema', () => {
      const itemSchema = dtoToOpenApiSchema(usersTable, ['passwordHash']);
      const schema = pagedResponseToOpenApiSchema(itemSchema);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.items).toBeDefined();
      expect(schema.properties!.items?.type).toBe('array');
      expect(schema.properties!.items?.items).toBeDefined();
      expect(schema.properties!.totalItems).toBeDefined();
      expect(schema.properties!.page).toBeDefined();
      expect(schema.properties!.pageSize).toBeDefined();
      expect(schema.properties!.totalPages).toBeDefined();
      expect(schema.properties!.hasNextPage).toBeDefined();
      expect(schema.properties!.hasPrevPage).toBeDefined();
    });

    it('marks all pagination fields as required', () => {
      const itemSchema = dtoToOpenApiSchema(usersTable);
      const schema = pagedResponseToOpenApiSchema(itemSchema);

      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('items');
      expect(schema.required).toContain('totalItems');
      expect(schema.required).toContain('page');
      expect(schema.required).toContain('pageSize');
      expect(schema.required).toContain('totalPages');
      expect(schema.required).toContain('hasNextPage');
      expect(schema.required).toContain('hasPrevPage');
    });
  });

  describe('paginationParamsSchema', () => {
    it('defines pagination query parameters', () => {
      expect(paginationParamsSchema.type).toBe('object');
      expect(paginationParamsSchema.properties!.page).toBeDefined();
      expect(paginationParamsSchema.properties!.pageSize).toBeDefined();
      expect(paginationParamsSchema.properties!.sortBy).toBeDefined();
      expect(paginationParamsSchema.properties!.sortOrder).toBeDefined();
    });

    it('defines page parameter with correct type', () => {
      expect(paginationParamsSchema.properties!.page?.type).toBe('integer');
      expect(paginationParamsSchema.properties!.page?.format).toBe('int32');
    });

    it('defines pageSize with min/max constraints', () => {
      expect(paginationParamsSchema.properties!.pageSize?.minimum).toBe(1);
      expect(paginationParamsSchema.properties!.pageSize?.maximum).toBe(100);
    });

    it('defines sortOrder as enum', () => {
      expect(paginationParamsSchema.properties!.sortOrder?.enum).toEqual(['asc', 'desc']);
    });
  });

  describe('toPaginationParams', () => {
    it('returns array of OpenApiParameter objects', () => {
      const params = toPaginationParams();

      expect(Array.isArray(params)).toBe(true);
      expect(params.length).toBe(4);
    });

    it('includes correct parameter metadata', () => {
      const params = toPaginationParams();

      const pageParam = params.find(p => p.name === 'page');
      expect(pageParam?.in).toBe('query');
      expect(pageParam?.required).toBeUndefined();
    });

    it('includes all pagination parameters', () => {
      const params = toPaginationParams();
      const paramNames = params.map(p => p.name);

      expect(paramNames).toContain('page');
      expect(paramNames).toContain('pageSize');
      expect(paramNames).toContain('sortBy');
      expect(paramNames).toContain('sortOrder');
    });
  });

  describe('generateOpenApiDocument', () => {
    it('generates valid OpenAPI 3.1 document structure', () => {
      const routes: any[] = [
        {
          path: '/users',
          method: 'get',
          operation: {
            summary: 'List users',
            responses: { '200': { description: 'Success' } }
          }
        }
      ];

      const doc = generateOpenApiDocument(
        { title: 'Test API', version: '1.0.0' },
        routes
      );

      expect(doc.openapi).toBe('3.1.0');
      expect(doc.info).toBeDefined();
      expect((doc.info as { title: string }).title).toBe('Test API');
      expect((doc.info as { version: string }).version).toBe('1.0.0');
      expect(doc.paths).toBeDefined();
    });

    it('includes paths with correct HTTP methods', () => {
      const routes = [
        {
          path: '/users',
          method: 'get' as const,
          operation: { summary: 'Get users', responses: { '200': { description: 'OK' } } }
        },
        {
          path: '/users',
          method: 'post' as const,
          operation: { summary: 'Create user', responses: { '201': { description: 'Created' } } }
        }
      ];

      const doc = generateOpenApiDocument({ title: 'API', version: '1.0' }, routes);

      expect(doc.paths!['/users'].get).toBeDefined();
      expect(doc.paths!['/users'].post).toBeDefined();
    });

    it('handles multiple paths', () => {
      const routes = [
        {
          path: '/users',
          method: 'get' as const,
          operation: { responses: { '200': { description: 'OK' } } }
        },
        {
          path: '/posts',
          method: 'get' as const,
          operation: { responses: { '200': { description: 'OK' } } }
        }
      ];

      const doc = generateOpenApiDocument({ title: 'API', version: '1.0' }, routes);

      expect(doc.paths!['/users']).toBeDefined();
      expect(doc.paths!['/posts']).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    describe('schemaToJson', () => {
      it('converts schema to formatted JSON string', () => {
        const schema: OpenApiSchema = { type: 'string' };
        const json = schemaToJson(schema);

        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual(schema);
      });

      it('formats JSON with 2-space indentation', () => {
        const schema: OpenApiSchema = { type: 'object', properties: { id: { type: 'integer' } } };
        const json = schemaToJson(schema);

        expect(json).toContain('  ');
      });
    });

    describe('deepCloneSchema', () => {
      it('creates deep copy of schema', () => {
        const original: OpenApiSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        };

        const cloned = deepCloneSchema(original);
        cloned.properties!.name!.type = 'number';

        expect(original.properties!.name!.type).toBe('string');
        expect(cloned.properties!.name!.type).toBe('number');
      });

      it('handles nested structures', () => {
        const original: OpenApiSchema = {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        };

        const cloned = deepCloneSchema(original);
        expect(cloned.properties!.items!.items).toEqual(original.properties!.items!.items);
      });
    });

    describe('mergeSchemas', () => {
      it('merges base and override schemas', () => {
        const base: OpenApiSchema = {
          type: 'object',
          properties: { name: { type: 'string' } }
        };

        const merged = mergeSchemas(base, {
          properties: { age: { type: 'integer' } }
        });

        expect(merged.properties!.name).toBeDefined();
        expect(merged.properties!.age).toBeDefined();
      });

      it('overrides required fields', () => {
        const base: OpenApiSchema = {
          type: 'object',
          required: ['name']
        };

        const merged = mergeSchemas(base, { required: ['name', 'age'] });

        expect(merged.required).toContain('name');
        expect(merged.required).toContain('age');
      });
    });
  });

  describe('Complete Integration Example', () => {
    it('generates complete API documentation', () => {
      const userResponseSchema = dtoToOpenApiSchema(usersTable, ['passwordHash']);
      const createUserSchema = createDtoToOpenApiSchema(usersTable);
      const updateUserSchema = updateDtoToOpenApiSchema(usersTable);
      const filterSchema = whereInputToOpenApiSchema(usersTable);
      const pagedSchema = pagedResponseToOpenApiSchema(userResponseSchema);

      const routes = [
        {
          path: '/users',
          method: 'get' as const,
          operation: {
            summary: 'List all users',
            description: 'Returns a paginated list of users',
            parameters: toPaginationParams(),
            requestBody: {
              description: 'Filter criteria',
              required: false,
              content: {
                'application/json': { schema: filterSchema }
              }
            },
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': { schema: pagedSchema }
                }
              }
            }
          }
        },
        {
          path: '/users',
          method: 'post' as const,
          operation: {
            summary: 'Create a new user',
            requestBody: {
              description: 'User data',
              required: true,
              content: {
                'application/json': { schema: createUserSchema }
              }
            },
            responses: {
              '201': {
                description: 'User created',
                content: {
                  'application/json': { schema: userResponseSchema }
                }
              }
            }
          }
        },
        {
          path: '/users/{id}',
          method: 'get' as const,
          operation: {
            summary: 'Get user by ID',
            responses: {
              '200': {
                description: 'User found',
                content: {
                  'application/json': { schema: userResponseSchema }
                }
              }
            }
          }
        },
        {
          path: '/users/{id}',
          method: 'patch' as const,
          operation: {
            summary: 'Update user',
            requestBody: {
              description: 'Update data',
              required: true,
              content: {
                'application/json': { schema: updateUserSchema }
              }
            },
            responses: {
              '200': {
                description: 'User updated',
                content: {
                  'application/json': { schema: userResponseSchema }
                }
              }
            }
          }
        }
      ];

      const doc = generateOpenApiDocument(
        {
          title: 'Users API',
          version: '1.0.0',
          description: 'API for managing users'
        },
        routes
      );

      expect(doc.openapi).toBe('3.1.0');
      expect((doc.info as { title: string }).title).toBe('Users API');
      expect(doc.paths!['/users']).toBeDefined();
      expect(doc.paths!['/users'].get).toBeDefined();
      expect(doc.paths!['/users'].post).toBeDefined();
      expect(doc.paths!['/users/{id}']).toBeDefined();
      expect(doc.paths!['/users/{id}'].get).toBeDefined();
      expect(doc.paths!['/users/{id}'].patch).toBeDefined();
    });
  });
});
