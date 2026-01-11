/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { Column, PrimaryKey, Entity } from '../../src/index.js';
import type { Dto, WithRelations, CreateDto, UpdateDto, Simplify } from '../../src/dto/index.js';
import {
  toResponse,
  toResponseBuilder,
  withDefaults,
  withDefaultsBuilder,
  exclude,
  pick,
  mapFields
} from '../../src/dto/index.js';

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

describe('DTO Type Utilities', () => {
  describe('Simplify utility', () => {
    it('flattens intersection types', () => {
      type A = { a: string };
      type B = { b: number };
      type AB = Simplify<A & B>;

      const value: AB = { a: 'test', b: 42 };
      expect(value.a).toBe('test');
      expect(value.b).toBe(42);
    });
  });

  describe('Dto type inference', () => {
    it('creates correct runtime types', () => {
      type UserResponse = Dto<typeof usersTable, 'passwordHash'>;

      const user: UserResponse = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        bio: 'Hello',
        createdAt: '2024-01-01'
      };

      expect(user.id).toBe(1);
      expect(user.name).toBe('John');
    });
  });

  describe('WithRelations type composition', () => {
    it('composes base DTO with nested relations', () => {
      type UserResponse = Dto<typeof usersTable, 'passwordHash'>;
      type PostResponse = Dto<typeof postsTable, 'authorId'>;
      type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;

      const user: UserWithPosts = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        bio: null,
        createdAt: '2024-01-01',
        posts: [
          { id: 1, title: 'Post 1', content: 'Content', published: true }
        ]
      };

      expect(user.posts.length).toBe(1);
      expect(user.posts[0].title).toBe('Post 1');
    });
  });

  describe('CreateDto type inference', () => {
    it('creates correct input types', () => {
      type CreateUser = CreateDto<typeof usersTable>;

      const input = {
        name: 'John',
        email: 'john@example.com'
      } satisfies CreateUser;

      expect(input.name).toBe('John');
      expect(input.email).toBe('john@example.com');
    });
  });

  describe('UpdateDto type inference', () => {
    it('allows partial updates', () => {
      type UpdateUser = UpdateDto<typeof usersTable>;

      const input = {
        name: 'Jane'
      } satisfies UpdateUser;

      expect(input.name).toBe('Jane');
    });
  });

  describe('Entity class support', () => {
    describe('Dto with Entity class', () => {
      it('creates DTO from Entity class', () => {
        type UserResponse = Dto<typeof TestUser, 'passwordHash'>;

        const user: UserResponse = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          bio: 'Hello',
          createdAt: '2024-01-01'
        };

        expect(user.id).toBe(1);
        expect(user.name).toBe('John');
      });

      it('excludes specified fields from Entity', () => {
        type UserPublic = Dto<typeof TestUser, 'passwordHash' | 'bio'>;

        const user: UserPublic = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          createdAt: '2024-01-01'
        } as any;

        expect(user.id).toBe(1);
        expect('passwordHash' in user).toBe(false);
      });
    });

    describe('WithRelations with Entity class', () => {
      it('composes DTO with relations from Entity class', () => {
        type UserResponse = Dto<typeof TestUser, 'passwordHash'>;

        type UserWithPosts = WithRelations<UserResponse, {
          posts: { id: number; title: string }[]
        }>;

        const user: UserWithPosts = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          bio: 'Hello',
          createdAt: '2024-01-01',
          posts: [
            { id: 1, title: 'Post 1' }
          ]
        };

        expect(user.posts.length).toBe(1);
        expect(user.posts[0].title).toBe('Post 1');
      });
    });

    describe('CreateDto with Entity class', () => {
      it('creates input type from Entity class', () => {
        type CreateUser = CreateDto<typeof TestUser>;

        const input = {
          name: 'John',
          email: 'john@example.com'
        } satisfies CreateUser;

        expect(input.name).toBe('John');
        expect(input.email).toBe('john@example.com');
      });

      it('allows optional fields in CreateDto from Entity', () => {
        type CreateUser = CreateDto<typeof TestUser>;

        const input = {
          name: 'John',
          email: 'john@example.com',
          bio: 'Developer'
        } satisfies CreateUser;

        expect(input.bio).toBe('Developer');
      });
    });

    describe('UpdateDto with Entity class', () => {
      it('allows partial updates from Entity class', () => {
        type UpdateUser = UpdateDto<typeof TestUser>;

        const input = {
          name: 'Jane'
        } satisfies UpdateUser;

        expect(input.name).toBe('Jane');
      });

      it('excludes specified fields from UpdateDto', () => {
        type UpdateUser = UpdateDto<typeof TestUser, 'id' | 'createdAt'>;

        const input = {
          name: 'Jane'
        } satisfies UpdateUser;

        expect(input.name).toBe('Jane');
      });
    });
  });

  describe('DTO Transform Utilities', () => {
    describe('toResponse', () => {
      it('merges input with auto-generated fields', () => {
        const input = { name: 'John', email: 'john@example.com' } as any;
        const result = toResponse(input, {
          id: 1,
          createdAt: '2024-01-01'
        }) as any;

        expect(result.name).toBe('John');
        expect(result.email).toBe('john@example.com');
        expect(result.id).toBe(1);
        expect(result.createdAt).toBe('2024-01-01');
      });
    });

    describe('toResponseBuilder', () => {
      it('creates reusable response builder', () => {
        const builder = toResponseBuilder<any, any>({
          active: true,
          createdAt: new Date().toISOString()
        });

        const result1 = builder({ name: 'John' });
        const result2 = builder({ name: 'Jane' });

        expect(result1.active).toBe(true);
        expect(result2.active).toBe(true);
      });

      it('supports dynamic auto-fields', () => {
        let counter = 0;
        const builder = toResponseBuilder<any, any>(() => ({
          id: ++counter,
          createdAt: new Date().toISOString()
        }));

        const result1 = builder({ name: 'John' });
        const result2 = builder({ name: 'Jane' });

        expect(result1.id).toBe(1);
        expect(result2.id).toBe(2);
      });
    });

    describe('withDefaults', () => {
      it('merges defaults into partial object', () => {
        const partial = { name: 'John' };
        const result = withDefaults(partial, {
          name: '',
          email: '',
          active: true
        });

        expect(result.name).toBe('John');
        expect(result.email).toBe('');
        expect(result.active).toBe(true);
      });

      it('partial overrides defaults', () => {
        const partial = { active: false };
        const result = withDefaults(partial, {
          name: '',
          email: '',
          active: true
        });

        expect(result.active).toBe(false);
      });
    });

    describe('withDefaultsBuilder', () => {
      it('creates reusable defaults applier', () => {
        const applyDefaults = withDefaultsBuilder<any>({
          active: true,
          createdAt: new Date().toISOString()
        });

        const result1 = applyDefaults({ name: 'John' });
        const result2 = applyDefaults({ name: 'Jane' });

        expect(result1.active).toBe(true);
        expect(result2.active).toBe(true);
      });
    });

    describe('exclude', () => {
      it('removes specified fields', () => {
        const user = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          passwordHash: 'secret123'
        };

        const result = exclude(user, 'passwordHash');

        expect(result.id).toBe(1);
        expect(result.name).toBe('John');
        expect('passwordHash' in result).toBe(false);
      });

      it('removes multiple fields', () => {
        const user = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          passwordHash: 'secret123',
          apiKey: 'abc123'
        };

        const result = exclude(user, 'passwordHash', 'apiKey');

        expect('passwordHash' in result).toBe(false);
        expect('apiKey' in result).toBe(false);
        expect(result.name).toBe('John');
      });
    });

    describe('pick', () => {
      it('selects only specified fields', () => {
        const user = {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          passwordHash: 'secret123'
        };

        const result = pick(user, 'id', 'name', 'email');

        expect(result.id).toBe(1);
        expect(result.name).toBe('John');
        expect(result.email).toBe('john@example.com');
        expect('passwordHash' in result).toBe(false);
      });
    });

    describe('mapFields', () => {
      it('maps fields from one naming convention to another', () => {
        const apiUser = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const dbUser = mapFields(apiUser, {
          firstName: 'first_name',
          lastName: 'last_name'
        });

        expect(dbUser.first_name).toBe('John');
        expect(dbUser.last_name).toBe('Doe');
        expect(dbUser.email).toBe('john@example.com');
      });

      it('preserves unmapped fields', () => {
        const apiUser = {
          firstName: 'John',
          email: 'john@example.com'
        };

        const dbUser = mapFields(apiUser, {
          firstName: 'first_name'
        });

        expect(dbUser.first_name).toBe('John');
        expect(dbUser.email).toBe('john@example.com');
      });
    });
  });
});
