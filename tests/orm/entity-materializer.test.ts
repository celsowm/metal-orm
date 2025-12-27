import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import {
    Entity,
    Column,
    PrimaryKey,
    HasMany,
    BelongsTo,
    bootstrapEntities,
    materializeAs,
    DefaultEntityMaterializer,
    PrototypeMaterializationStrategy,
    ConstructorMaterializationStrategy
} from '../../src/decorators/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';

describe('EntityMaterializer', () => {
    afterEach(() => {
        clearEntityMetadata();
    });

    describe('materializeAs', () => {
        it('should create real class instances with instanceof check', () => {
            @Entity()
            class TestUser {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(100))
                name!: string;
            }

            bootstrapEntities();

            const rawResults = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ];

            const users = materializeAs(TestUser, rawResults);

            expect(users).toHaveLength(2);
            expect(users[0]).toBeInstanceOf(TestUser);
            expect(users[1]).toBeInstanceOf(TestUser);
            expect(users[0].id).toBe(1);
            expect(users[0].name).toBe('Alice');
            expect(users[1].id).toBe(2);
            expect(users[1].name).toBe('Bob');
        });

        it('should allow calling entity methods', () => {
            @Entity()
            class TestUserWithMethod {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(100))
                firstName!: string;

                @Column(col.varchar(100))
                lastName!: string;

                getFullName(): string {
                    return `${this.firstName} ${this.lastName}`;
                }
            }

            bootstrapEntities();

            const rawResults = [
                { id: 1, firstName: 'Alice', lastName: 'Smith' }
            ];

            const users = materializeAs(TestUserWithMethod, rawResults);

            expect(users[0]).toBeInstanceOf(TestUserWithMethod);
            expect(users[0].getFullName()).toBe('Alice Smith');
        });

        it('should handle nested relation data', () => {
            @Entity()
            class TestPost {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(255))
                title!: string;
            }

            @Entity()
            class TestAuthor {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(100))
                name!: string;

                @HasMany({ target: () => TestPost })
                posts!: TestPost[];
            }

            bootstrapEntities();

            const rawResults = [
                {
                    id: 1,
                    name: 'Alice',
                    posts: [
                        { id: 1, title: 'First Post' },
                        { id: 2, title: 'Second Post' }
                    ]
                }
            ];

            const authors = materializeAs(TestAuthor, rawResults);

            expect(authors[0]).toBeInstanceOf(TestAuthor);
            expect(authors[0].name).toBe('Alice');
            expect(authors[0].posts).toHaveLength(2);
            expect(authors[0].posts[0].title).toBe('First Post');
        });
    });

    describe('DefaultEntityMaterializer', () => {
        it('should work with PrototypeMaterializationStrategy', () => {
            @Entity()
            class TestEntity {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(100))
                value!: string;
            }

            bootstrapEntities();

            const materializer = new DefaultEntityMaterializer(
                new PrototypeMaterializationStrategy()
            );

            const entity = materializer.materialize(TestEntity, { id: 1, value: 'test' });

            expect(entity).toBeInstanceOf(TestEntity);
            expect(entity.id).toBe(1);
            expect(entity.value).toBe('test');
        });

        it('should work with ConstructorMaterializationStrategy', () => {
            @Entity()
            class TestEntityWithDefaults {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;

                @Column(col.varchar(100))
                value!: string;

                constructorCalled = false;

                constructor() {
                    this.constructorCalled = true;
                }
            }

            bootstrapEntities();

            const materializer = new DefaultEntityMaterializer(
                new ConstructorMaterializationStrategy()
            );

            const entity = materializer.materialize(TestEntityWithDefaults, { id: 1, value: 'test' });

            expect(entity).toBeInstanceOf(TestEntityWithDefaults);
            expect(entity.constructorCalled).toBe(true);
            expect(entity.id).toBe(1);
        });

        it('should materialize many entities', () => {
            @Entity()
            class TestMultiple {
                @PrimaryKey(col.primaryKey(col.int()))
                id!: number;
            }

            bootstrapEntities();

            const materializer = new DefaultEntityMaterializer();
            const entities = materializer.materializeMany(TestMultiple, [
                { id: 1 },
                { id: 2 },
                { id: 3 }
            ]);

            expect(entities).toHaveLength(3);
            entities.forEach((e, i) => {
                expect(e).toBeInstanceOf(TestMultiple);
                expect(e.id).toBe(i + 1);
            });
        });
    });
});
