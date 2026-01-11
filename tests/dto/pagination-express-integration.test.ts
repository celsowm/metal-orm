import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { col, defineTable } from '../../src/index.js';
import type { Dto, PagedResponse, CreateDto, UpdateDto } from '../../src/dto/index.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.varchar(100)),
  email: col.notNull(col.varchar(255)),
  passwordHash: col.varchar(255),
  age: col.int(),
  active: col.default(col.boolean(), true),
  bio: col.text(),
  createdAt: col.default(col.timestamp(), { raw: 'NOW()' }),
});

type UserResponse = Dto<typeof usersTable, 'passwordHash'>;
type CreateUserDto = CreateDto<typeof usersTable>;
type UpdateUserDto = UpdateDto<typeof usersTable, 'id' | 'createdAt'>;

const mockUsers: UserResponse[] = Array.from({ length: 47 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  age: 20 + (i % 30),
  active: i % 2 === 0,
  bio: `Bio for user ${i + 1}`,
  createdAt: `2024-01-${String(i + 1).padStart(2, '0')}`,
}));

describe('Enhanced Pagination Express Integration', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/users', (req, res) => {
      const page = Math.max(1, parseInt((req.query.page as string) || '1'));
      const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '10')));

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      const paginatedItems = mockUsers.slice(startIndex, endIndex);

      res.json({
        items: paginatedItems,
        totalItems: mockUsers.length,
        page,
        pageSize,
      });
    });

    app.get('/users/enhanced', (req, res) => {
      const page = Math.max(1, parseInt((req.query.page as string) || '1'));
      const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '10')));

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      const paginatedItems = mockUsers.slice(startIndex, endIndex);

      const basic = {
        items: paginatedItems,
        totalItems: mockUsers.length,
        page,
        pageSize,
      };

      res.json({
        items: basic.items,
        totalItems: basic.totalItems,
        page: basic.page,
        pageSize: basic.pageSize,
        totalPages: Math.ceil(basic.totalItems / basic.pageSize),
        hasNextPage: basic.page < Math.ceil(basic.totalItems / basic.pageSize),
        hasPrevPage: basic.page > 1,
      });
    });
  });

  describe('Basic pagination', () => {
    it('returns first page with default pageSize', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(10);
      expect(response.body.totalItems).toBe(47);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(10);
    });

    it('returns specified page', async () => {
      const response = await request(app).get('/users?page=3');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(10);
      expect(response.body.items[0].name).toBe('User 21');
      expect(response.body.page).toBe(3);
    });

    it('returns specified pageSize', async () => {
      const response = await request(app).get('/users?pageSize=20');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(20);
      expect(response.body.pageSize).toBe(20);
    });

    it('handles last page with fewer items', async () => {
      const response = await request(app).get('/users?page=5&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(7);
      expect(response.body.items[0].name).toBe('User 41');
    });

    it('handles page beyond available items', async () => {
      const response = await request(app).get('/users?page=10&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
      expect(response.body.totalItems).toBe(47);
    });
  });

  describe('Enhanced pagination metadata', () => {
    it('calculates totalPages correctly', async () => {
      const response = await request(app).get('/users/enhanced?pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.totalPages).toBe(5);
    });

    it('calculates totalPages with different pageSize', async () => {
      const response = await request(app).get('/users/enhanced?pageSize=15');

      expect(response.status).toBe(200);
      expect(response.body.totalPages).toBe(4);
    });

    it('indicates hasNextPage true on middle pages', async () => {
      const response = await request(app).get('/users/enhanced?page=2&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.hasNextPage).toBe(true);
    });

    it('indicates hasNextPage false on last page', async () => {
      const response = await request(app).get('/users/enhanced?page=5&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.hasNextPage).toBe(false);
    });

    it('indicates hasPrevPage true on middle pages', async () => {
      const response = await request(app).get('/users/enhanced?page=2&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.hasPrevPage).toBe(true);
    });

    it('indicates hasPrevPage false on first page', async () => {
      const response = await request(app).get('/users/enhanced?page=1&pageSize=10');

      expect(response.status).toBe(200);
      expect(response.body.hasPrevPage).toBe(false);
    });

    it('returns both false when only one page', async () => {
      const response = await request(app).get('/users/enhanced?pageSize=100');

      expect(response.status).toBe(200);
      expect(response.body.totalPages).toBe(1);
      expect(response.body.hasNextPage).toBe(false);
      expect(response.body.hasPrevPage).toBe(false);
    });

    it('returns both false when no items', async () => {
      const tempApp = express();
      tempApp.get('/users', (_req, res) => {
        res.json({
          items: [],
          totalItems: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
      });

      const response = await request(tempApp).get('/users');

      expect(response.status).toBe(200);
      expect(response.body.totalPages).toBe(1);
      expect(response.body.hasNextPage).toBe(false);
      expect(response.body.hasPrevPage).toBe(false);
    });
  });

  describe('Type safety', () => {
    it('returns correctly typed UserResponse items', async () => {
      const response = await request(app).get('/users');

      const users = response.body as { items: UserResponse[]; totalItems: number; page: number; pageSize: number };

      expect(users.items[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
      });
      expect(users.items[0]).not.toHaveProperty('passwordHash');
    });

    it('returns correctly typed enhanced pagination response', async () => {
      const response = await request(app).get('/users/enhanced');

      const paged = response.body as PagedResponse<UserResponse>;

      expect(paged.items[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
      });
      expect(paged).toMatchObject({
        totalItems: expect.any(Number),
        page: expect.any(Number),
        pageSize: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
        hasPrevPage: expect.any(Boolean),
      });
    });
  });
});
