/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import type { Dto, WithRelations, CreateDto, UpdateDto, Simplify } from '../../src/dto/index.js';

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
});
