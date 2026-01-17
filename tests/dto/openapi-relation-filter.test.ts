import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { PrimaryKey, Entity, Column, hasMany, belongsTo } from '../../src/index.js';
import {
    relationFilterToOpenApiSchema,
    whereInputWithRelationsToOpenApiSchema,
    nestedWhereInputToOpenApiSchema,
} from '../../src/dto/openapi/index.js';
import type { OpenApiSchema } from '../../src/dto/openapi/types.js';

@Entity()
class Department {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.varchar(100)))
    name!: string;

    @Column(col.varchar(255))
    location?: string;
}

@Entity()
class User {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.varchar(100)))
    name!: string;

    @Column(col.notNull(col.varchar(255)))
    email!: string;

    @Column(col.varchar(255))
    passwordHash?: string;

    @Column(col.int())
    department_id?: number;
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
    passwordHash: col.varchar(255),
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
    passwordHash: col.varchar(255),
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

describe('Relation Filter Schema Generation', () => {
    describe('relationFilterToOpenApiSchema', () => {
        describe('BelongsTo relation (single relation)', () => {
            it('generates schema for belongsTo relation filter', () => {
                const relation = usersWithRelations.relations.department;
                expect(relation).toBeDefined();

                const schema = relationFilterToOpenApiSchema(relation!);
                expect(schema.type).toBe('object');
                expect(schema.properties).toBeDefined();
                expect(schema.properties!.id).toBeDefined();
                expect(schema.properties!.name).toBeDefined();
                expect(schema.properties!.location).toBeDefined();
            });

            it('excludes specified fields from relation filter', () => {
                const relation = usersWithRelations.relations.department;
                const schema = relationFilterToOpenApiSchema(relation!, { exclude: ['id'] });

                expect(schema.properties!.id).toBeUndefined();
                expect(schema.properties!.name).toBeDefined();
            });

            it('includes only specified fields from relation filter', () => {
                const relation = usersWithRelations.relations.department;
                const schema = relationFilterToOpenApiSchema(relation!, { include: ['name'] });

                expect(schema.properties!.name).toBeDefined();
                expect(schema.properties!.id).toBeUndefined();
                expect(schema.properties!.location).toBeUndefined();
            });

            it('marks required fields correctly', () => {
                const relation = usersWithRelations.relations.department;
                const schema = relationFilterToOpenApiSchema(relation!);

                expect(schema.required).toBeDefined();
                expect(schema.required).toContain('id');
                expect(schema.required).toContain('name');
            });
        });

        describe('HasMany relation (collection relation)', () => {
            it('generates schema for hasMany relation filter', () => {
                const relation = usersTable.relations.posts;
                expect(relation).toBeDefined();

                const schema = relationFilterToOpenApiSchema(relation!);
                expect(schema.type).toBe('object');
                expect(schema.properties).toBeDefined();
                expect(schema.properties!.some).toBeDefined();
                expect(schema.properties!.every).toBeDefined();
                expect(schema.properties!.none).toBeDefined();
                expect(schema.properties!.isEmpty).toBeDefined();
                expect(schema.properties!.isNotEmpty).toBeDefined();
            });

            it('includes nested filter properties for collection relations', () => {
                const relation = usersTable.relations.posts;
                const schema = relationFilterToOpenApiSchema(relation!);

                const someSchema = schema.properties!.some as OpenApiSchema;
                expect(someSchema.type).toBe('object');
                expect(someSchema.properties).toBeDefined();
                expect(someSchema.properties!.title).toBeDefined();
                expect(someSchema.properties!.content).toBeDefined();
            });

            it('includes isEmpty and isNotEmpty boolean filters', () => {
                const relation = usersTable.relations.posts;
                const schema = relationFilterToOpenApiSchema(relation!);

                expect(schema.properties!.isEmpty?.type).toBe('boolean');
                expect(schema.properties!.isNotEmpty?.type).toBe('boolean');
            });
        });
    });

    describe('whereInputWithRelationsToOpenApiSchema', () => {
        it('generates schema with columns and relations', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(usersWithRelations);

            expect(schema.type).toBe('object');
            expect(schema.properties).toBeDefined();

            expect(schema.properties!.id).toBeDefined();
            expect(schema.properties!.name).toBeDefined();
            expect(schema.properties!.email).toBeDefined();
            expect(schema.properties!.department).toBeDefined();
            expect(schema.properties!.posts).toBeUndefined();
        });

        it('excludes specified columns', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(usersWithRelations, {
                columnExclude: ['passwordHash'],
            });

            expect(schema.properties!.passwordHash).toBeUndefined();
            expect(schema.properties!.name).toBeDefined();
        });

        it('excludes specified relations', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(usersWithRelations, {
                relationExclude: ['department'],
            });

            expect(schema.properties!.department).toBeUndefined();
        });

        it('includes only specified columns', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(usersWithRelations, {
                columnInclude: ['id', 'name'],
            });

            expect(schema.properties!.id).toBeDefined();
            expect(schema.properties!.name).toBeDefined();
            expect(schema.properties!.email).toBeUndefined();
        });

        it('includes only specified relations', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(usersWithRelations, {
                relationInclude: [],
            });

            expect(schema.properties!.department).toBeUndefined();
        });

        it('respects maxDepth option', () => {
            const schema1 = whereInputWithRelationsToOpenApiSchema(usersWithRelations, { maxDepth: 1 });
            const schema2 = whereInputWithRelationsToOpenApiSchema(usersWithRelations, { maxDepth: 3 });

            expect(schema1).toBeDefined();
            expect(schema2).toBeDefined();
        });

        it('handles table without relations', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(departmentsTable);

            expect(schema.type).toBe('object');
            expect(schema.properties).toBeDefined();
            expect(schema.properties!.id).toBeDefined();
            expect(schema.properties!.name).toBeDefined();
        });

        it('handles table with hasMany relations', () => {
            const schema = whereInputWithRelationsToOpenApiSchema(departmentsWithUsers);

            expect(schema.properties!.users).toBeDefined();
            const usersSchema = schema.properties!.users as OpenApiSchema;
            expect(usersSchema.properties!.some).toBeDefined();
        });
    });

    describe('nestedWhereInputToOpenApiSchema', () => {
        it('generates nested schema with recursive relations', () => {
            const schema = nestedWhereInputToOpenApiSchema(usersWithRelations, 2);

            expect(schema.type).toBe('object');
            expect(schema.properties).toBeDefined();

            expect(schema.properties!.id).toBeDefined();
            expect(schema.properties!.name).toBeDefined();
            expect(schema.properties!.posts).toBeUndefined();
        });

        it('includes nested filters for hasMany relations', () => {
            const schema = nestedWhereInputToOpenApiSchema(departmentsWithUsers, 2);

            const usersSchema = schema.properties!.users as OpenApiSchema;
            expect(usersSchema.properties!.some).toBeDefined();
            expect(usersSchema.properties!.every).toBeDefined();
            expect(usersSchema.properties!.none).toBeDefined();
            expect(usersSchema.properties!.isEmpty).toBeDefined();
            expect(usersSchema.properties!.isNotEmpty).toBeDefined();
        });

        it('stops recursion when depth is 0', () => {
            const schema = nestedWhereInputToOpenApiSchema(usersWithRelations, 0);

            expect(schema.properties).toEqual({});
        });

        it('limits recursion to specified depth', () => {
            const schema = nestedWhereInputToOpenApiSchema(usersWithRelations, 1);

            expect(schema.properties!.department).toBeDefined();
        });

        it('handles deeply nested relations', () => {
            const schema = nestedWhereInputToOpenApiSchema(postsTable, 3);

            expect(schema.properties!.author).toBeDefined();
            const authorSchema = schema.properties!.author as OpenApiSchema;
            expect(authorSchema.properties!.name).toBeDefined();

            expect(schema.properties!.comments).toBeDefined();
            const commentsSchema = schema.properties!.comments as OpenApiSchema;
            expect(commentsSchema.properties!.some).toBeDefined();
        });
    });

    describe('Complete Integration', () => {
        it('generates complete filter schema for Post with nested relations', () => {
            const filterSchema = whereInputWithRelationsToOpenApiSchema(postsTable);

            expect(filterSchema.properties!.title).toBeDefined();
            expect(filterSchema.properties!.content).toBeDefined();
            expect(filterSchema.properties!.author).toBeDefined();
            const authorSchema = filterSchema.properties!.author as OpenApiSchema;
            expect(authorSchema.properties!.name).toBeDefined();
            expect(authorSchema.properties!.email).toBeDefined();

            expect(filterSchema.properties!.comments).toBeDefined();
            const commentsSchema = filterSchema.properties!.comments as OpenApiSchema;
            expect(commentsSchema.properties!.some).toBeDefined();
        });

        it('generates schema with all filter operators for relation columns', () => {
            const schema = nestedWhereInputToOpenApiSchema(postsTable, 2);

            const authorSchema = schema.properties!.author as OpenApiSchema;
            expect(authorSchema.type).toBe('object');
            expect(authorSchema.properties!.name).toBeDefined();
            expect(authorSchema.properties!.email).toBeDefined();

            const commentsSchema = schema.properties!.comments as OpenApiSchema;
            expect(commentsSchema.properties!.some).toBeDefined();
            const someSchema = commentsSchema.properties!.some as OpenApiSchema;
            expect(someSchema.properties!.content).toBeDefined();
        });
    });
});
