import { describe, expect, it } from 'vitest';
import express from 'express';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { belongsTo, hasMany } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  userId: col.int(),
});

setRelations(users, {
  posts: hasMany(posts, 'userId'),
});

setRelations(posts, {
  author: belongsTo(users, 'userId'),
});

users.columns.name.notNull = true;
users.columns.email.notNull = true;
posts.columns.title.notNull = true;

const buildOpenApiSpec = () => {
  const { output, parameters } = selectFrom(users)
    .select('id', 'name', 'email')
    .where(eq(users.columns.name, 'Alice'))
    .includePick('posts', ['id', 'title'])
    .getSchema({ mode: 'selected' });

  const { input } = selectFrom(users).getSchema({
    input: {
      mode: 'create',
      excludePrimaryKey: true,
      relationMode: 'mixed',
      maxDepth: 1,
    },
  });

  if (!input) {
    throw new Error('Expected create input schema for users.');
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Metal ORM Express Test',
      version: '0.1.0',
    },
    paths: {
      '/users': {
        get: {
          summary: 'List users',
          parameters,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: output,
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: input,
              },
            },
          },
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
    },
  };
};

describe('OpenAPI schema generator with Express', () => {
  it('serves OpenAPI schema from an Express route', async () => {
    const app = express();

    app.get('/openapi.json', (_req, res) => {
      res.json(buildOpenApiSpec());
    });

    const server = await new Promise<import('node:http').Server>((resolve, reject) => {
      const listener = app.listen(0, () => resolve(listener));
      listener.on('error', reject);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected Express server to bind to a TCP port.');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/openapi.json`);
      expect(response.ok).toBe(true);

      type OpenApiSchema = {
        type?: string;
        format?: string;
        properties?: Record<string, OpenApiSchema>;
        items?: OpenApiSchema;
        required?: string[];
        anyOf?: Array<OpenApiSchema>;
      };
      type OpenApiSpec = {
        openapi: string;
        paths: {
          '/users': {
            get: {
              parameters?: Array<{
                name: string;
                in: string;
                style?: string;
                explode?: boolean;
                schema?: OpenApiSchema;
              }>;
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: OpenApiSchema;
                    };
                  };
                };
              };
            };
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: OpenApiSchema;
                  };
                };
              };
            };
          };
        };
      };

      const spec = (await response.json()) as OpenApiSpec;
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.paths['/users']).toBeDefined();

      const getSchema = spec.paths['/users'].get.responses['200'].content['application/json'].schema;
      expect(getSchema.type).toBe('array');
      expect(getSchema.items?.properties?.id?.type).toBe('integer');
      expect(getSchema.items?.properties?.name?.type).toBe('string');
      expect(getSchema.items?.properties?.email?.type).toBe('string');
      expect(getSchema.items?.properties?.posts?.type).toBe('array');
      expect(getSchema.items?.properties?.posts?.items?.properties?.id).toBeDefined();
      expect(getSchema.items?.properties?.posts?.items?.properties?.title).toBeDefined();

      const filterParam = spec.paths['/users'].get.parameters?.find(param => param.name === 'filter');
      expect(filterParam?.in).toBe('query');
      expect(filterParam?.style).toBe('deepObject');
      expect(filterParam?.explode).toBe(true);
      expect(filterParam?.schema?.properties?.name).toBeDefined();

      const postSchema = spec.paths['/users'].post.requestBody.content['application/json'].schema;
      expect(postSchema.required).toContain('name');
      expect(postSchema.required).toContain('email');
      expect(postSchema.properties?.posts?.type).toBe('array');
      const postsItems = postSchema.properties?.posts?.items;
      const anyOf = postsItems?.anyOf ?? [];
      expect(anyOf.some(entry => entry.type === 'object')).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    }
  });
});
