import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { PrimaryKey, Entity, Column, hasMany, belongsTo } from '../../src/index.js';
import {
    nestedDtoToOpenApiSchema,
    updateDtoWithRelationsToOpenApiSchema,
    generateComponentSchemas,
    generateRelationComponents,
    createApiComponentsSection,
    createRef,
    schemaToRef,
    parameterToRef,
    responseToRef,
    replaceWithRefs,
    extractReusableSchemas,
    isComponentReference,
    type ComponentReference,
    type OpenApiSchema,
} from '../../src/dto/openapi/index.js';

@Entity()
class Department {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.varchar(100)))
    name!: string;

    @Column(col.varchar(255))
    location?: string;
}

const departmentsTable = defineTable('departments', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    name: col.notNull(col.varchar(100)),
    location: col.varchar(255),
});

const usersTable = defineTable('users', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    name: col.notNull(col.varchar(100)),
    email: col.notNull(col.varchar(255)),
    department_id: col.int(),
});

const postsTable = defineTable('posts', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    title: col.notNull(col.varchar(255)),
    content: col.text(),
    authorId: col.notNull(col.int()),
    published: col.default(col.boolean(), false),
});

const commentsTable = defineTable('comments', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    content: col.notNull(col.text()),
    postId: col.notNull(col.int()),
    authorId: col.int(),
});

const departmentsWithUsers = defineTable('departments', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    name: col.notNull(col.varchar(100)),
    location: col.varchar(255),
}, {
    users: hasMany(usersTable, 'department_id'),
});

const usersWithRelations = defineTable('users', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    name: col.notNull(col.varchar(100)),
    email: col.notNull(col.varchar(255)),
    department_id: col.int(),
}, {
    department: belongsTo(departmentsTable, 'department_id'),
});

postsTable.relations = {
    author: belongsTo(usersTable, 'authorId'),
    comments: hasMany(commentsTable, 'postId'),
};

usersTable.relations = {
    posts: hasMany(postsTable, 'authorId'),
};

describe('Nested DTO Schema Generation', () => {
    describe('nestedDtoToOpenApiSchema', () => {
        it('generates nested schema with relations', () => {
            const schema = nestedDtoToOpenApiSchema(usersWithRelations);

            expect(schema.type).toBe('object');
            expect(schema.properties).toBeDefined();

            expect(schema.properties!.id).toBeDefined();
            expect(schema.properties!.name).toBeDefined();
            expect(schema.properties!.department).toBeDefined();
        });

        it('includes nested relation objects', () => {
            const schema = nestedDtoToOpenApiSchema(usersWithRelations);

            const deptSchema = schema.properties!.department as OpenApiSchema;
            expect(deptSchema.type).toBe('object');
            expect(deptSchema.properties).toBeDefined();
            expect(deptSchema.properties!.id).toBeDefined();
            expect(deptSchema.properties!.name).toBeDefined();
        });

        it('respects maxDepth option', () => {
            const schema1 = nestedDtoToOpenApiSchema(usersWithRelations, { maxDepth: 1 });
            const schema2 = nestedDtoToOpenApiSchema(usersWithRelations, { maxDepth: 3 });

            expect(schema1).toBeDefined();
            expect(schema2).toBeDefined();
        });

        it('handles array relations', () => {
            const schema = nestedDtoToOpenApiSchema(departmentsWithUsers);

            expect(schema.properties!.users).toBeDefined();
            const usersSchema = schema.properties!.users as OpenApiSchema;
            expect(usersSchema.type).toBe('array');
            expect(usersSchema.items).toBeDefined();
        });

        it('can exclude relations', () => {
            const schema = nestedDtoToOpenApiSchema(usersWithRelations, {
                includeRelations: false,
            });

            expect(schema.properties!.department).toBeUndefined();
        });
    });

    describe('updateDtoWithRelationsToOpenApiSchema', () => {
        it('generates update DTO with nullable fields', () => {
            const schema = updateDtoWithRelationsToOpenApiSchema(usersWithRelations);

            expect(schema.type).toBe('object');
            expect(schema.properties).toBeDefined();

            const nameSchema = schema.properties!.name as OpenApiSchema;
            expect(nameSchema.nullable).toBe(true);
        });

        it('excludes auto-generated fields', () => {
            const schema = updateDtoWithRelationsToOpenApiSchema(usersWithRelations);

            expect(schema.properties!.id).toBeUndefined();
        });
    });
});

describe('Component Schema Generation', () => {
    describe('generateComponentSchemas', () => {
        it('generates component schemas for multiple tables', () => {
            const components = generateComponentSchemas([
                { name: 'User', table: usersTable },
                { name: 'Department', table: departmentsTable },
            ]);

            expect(components.User).toBeDefined();
            expect(components.Department).toBeDefined();
        });

        it('applies prefix to component names', () => {
            const components = generateComponentSchemas(
                [
                    { name: 'User', table: usersTable },
                ],
                { prefix: 'Api' }
            );

            expect(components.ApiUser).toBeDefined();
            expect(components.User).toBeUndefined();
        });

        it('excludes specified fields', () => {
            const components = generateComponentSchemas(
                [{ name: 'User', table: usersTable }],
                { exclude: ['passwordHash'] }
            );

            expect(components.User!.properties!.passwordHash).toBeUndefined();
        });
    });

    describe('generateRelationComponents', () => {
        it('generates Create, Update, and Filter components', () => {
            const components = generateRelationComponents([
                { name: 'User', table: usersTable },
            ]);

            expect(components.UserCreate).toBeDefined();
            expect(components.UserUpdate).toBeDefined();
            expect(components.UserFilter).toBeDefined();
        });

        it('includes relation filters in Filter components', () => {
            const components = generateRelationComponents([
                { name: 'User', table: usersWithRelations },
            ]);

            const filterSchema = components.UserFilter as OpenApiSchema;
            expect(filterSchema.properties!.department).toBeDefined();
        });
    });

    describe('createApiComponentsSection', () => {
        it('creates components section with schemas', () => {
            const components = createApiComponentsSection({
                User: { type: 'object', properties: { id: { type: 'integer' } } },
            });

            expect(components.schemas).toBeDefined();
            expect(components.schemas!.User).toBeDefined();
        });

        it('includes parameters and responses when provided', () => {
            const components = createApiComponentsSection(
                { User: { type: 'object', properties: {} } },
                { page: { type: 'integer' } },
                { NotFound: { description: 'Not found' } }
            );

            expect(components.schemas).toBeDefined();
            expect(components.parameters).toBeDefined();
            expect(components.responses).toBeDefined();
        });

        it('omits empty sections', () => {
            const components = createApiComponentsSection({});

            expect(components.schemas).toBeUndefined();
        });
    });
});

describe('$ref Support', () => {
    describe('createRef', () => {
        it('creates valid $ref path', () => {
            const ref = createRef('schemas/User');

            expect(ref.$ref).toBe('#/components/schemas/User');
        });

        it('creates $ref for parameters', () => {
            const ref = createRef('parameters/page');

            expect(ref.$ref).toBe('#/components/parameters/page');
        });

        it('creates $ref for responses', () => {
            const ref = createRef('responses/NotFound');

            expect(ref.$ref).toBe('#/components/responses/NotFound');
        });
    });

    describe('schemaToRef', () => {
        it('creates schema $ref', () => {
            const ref = schemaToRef('User');

            expect(ref.$ref).toBe('#/components/schemas/User');
        });
    });

    describe('parameterToRef', () => {
        it('creates parameter $ref', () => {
            const ref = parameterToRef('page');

            expect(ref.$ref).toBe('#/components/parameters/page');
        });
    });

    describe('responseToRef', () => {
        it('creates response $ref', () => {
            const ref = responseToRef('NotFound');

            expect(ref.$ref).toBe('#/components/responses/NotFound');
        });
    });

    describe('isComponentReference', () => {
        it('returns true for $ref schema', () => {
            const schema: OpenApiSchema = { $ref: '#/components/schemas/User' };

            expect(isComponentReference(schema)).toBe(true);
        });

        it('returns false for regular schema', () => {
            const schema: OpenApiSchema = { type: 'string' };

            expect(isComponentReference(schema)).toBe(false);
        });
    });

    describe('replaceWithRefs', () => {
        it('replaces nested schemas with $refs', () => {
            const schemaMap: Record<string, OpenApiSchema> = {
                Address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' },
                    },
                },
            };

            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                            city: { type: 'string' },
                        },
                    },
                },
            };

            const result = replaceWithRefs(schema, schemaMap, 'components/schemas');

            const addressRef = result.properties!.address as ComponentReference;
            expect(addressRef.$ref).toBe('#/components/schemas/Address');
        });

        it('preserves existing $refs', () => {
            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    existing: { $ref: '#/components/schemas/Other' },
                },
            };

            const result = replaceWithRefs(schema, {}, 'schemas');

            const existingRef = result.properties!.existing as ComponentReference;
            expect(existingRef.$ref).toBe('#/components/schemas/Other');
        });

        it('handles array items', () => {
            const schemaMap: Record<string, OpenApiSchema> = {
                Tag: { type: 'string' },
            };

            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            };

            const result = replaceWithRefs(schema, schemaMap, 'schemas');

            expect(result.properties!.tags).toBeDefined();
        });
    });

    describe('extractReusableSchemas', () => {
        it('extracts nested object schemas', () => {
            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                            city: { type: 'string' },
                        },
                    },
                },
            };

            const extracted = extractReusableSchemas(schema);

            expect(extracted.Address).toBeDefined();
            expect(extracted.Address!.properties!.street).toBeDefined();
        });

        it('avoids duplicates', () => {
            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    billingAddress: {
                        type: 'object',
                        properties: { street: { type: 'string' } },
                    },
                    shippingAddress: {
                        type: 'object',
                        properties: { street: { type: 'string' } },
                    },
                },
            };

            const extracted = extractReusableSchemas(schema);

            expect(extracted.BillingAddress).toBeDefined();
            expect(extracted.ShippingAddress).toBeDefined();
            expect(Object.keys(extracted)).toHaveLength(2);
        });

        it('handles deeply nested schemas', () => {
            const schema: OpenApiSchema = {
                type: 'object',
                properties: {
                    company: {
                        type: 'object',
                        properties: {
                            address: {
                                type: 'object',
                                properties: {
                                    street: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            };

            const extracted = extractReusableSchemas(schema);

            expect(extracted.CompanyAddress).toBeDefined();
        });
    });
});

describe('Complete Integration', () => {
    it('generates complete component structure for API', () => {
        const schemas = generateComponentSchemas([
            { name: 'User', table: usersWithRelations },
            { name: 'Post', table: postsTable },
        ], { prefix: '' });

        const relationComponents = generateRelationComponents([
            { name: 'User', table: usersWithRelations },
            { name: 'Post', table: postsTable },
        ]);

        const components = createApiComponentsSection(
            schemas,
            { page: { type: 'integer', minimum: 1 } },
            { NotFound: { description: 'Resource not found' } }
        );

        expect(components.schemas).toBeDefined();
        expect(Object.keys(components.schemas!)).toContain('User');
        expect(Object.keys(components.schemas!)).toContain('Post');

        expect(components.parameters).toBeDefined();
        expect(components.responses).toBeDefined();

        expect(relationComponents.UserFilter).toBeDefined();
        expect(relationComponents.PostFilter).toBeDefined();
    });

    it('generates nested DTO with relations for API documentation', () => {
        const userResponse = nestedDtoToOpenApiSchema(usersWithRelations, { maxDepth: 2 });

        expect(userResponse.properties!.id).toBeDefined();
        expect(userResponse.properties!.department).toBeDefined();

        const deptSchema = userResponse.properties!.department as OpenApiSchema;
        expect(deptSchema.properties!.id).toBeDefined();
        expect(deptSchema.properties!.name).toBeDefined();
    });
});
