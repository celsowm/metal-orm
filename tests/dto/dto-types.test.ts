/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { Column, PrimaryKey, Entity } from '../../src/index.js';
import type { Dto, WithRelations, CreateDto, UpdateDto, Simplify } from '../../src/dto/index.js';

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
});
