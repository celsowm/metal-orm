import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { col, defineTable } from '../../src/index.js';
import type { Dto } from '../../src/dto/index.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.varchar(100)),
  email: col.notNull(col.varchar(255)),
  passwordHash: col.varchar(255),
  bio: col.text(),
  createdAt: col.default(col.timestamp(), { raw: 'NOW()' }),
});

type UserResponse = Dto<typeof usersTable, 'passwordHash'>;

const mockUsers: UserResponse[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', bio: 'Hello World', createdAt: '2024-01-01' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', bio: 'Developer', createdAt: '2024-01-02' },
];

describe('DTO Express Integration', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/users', (req, res) => {
      res.json(mockUsers);
    });

    app.get('/users/:id', (req, res) => {
      const user = mockUsers.find(u => u.id === parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    });
  });

  describe('GET /users', () => {
    it('returns all users without passwordHash', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      const users = response.body as UserResponse[];
      expect(users[0].id).toBe(1);
      expect(users[0].name).toBe('John Doe');
      expect(users[0].email).toBe('john@example.com');
      expect(users[0].bio).toBe('Hello World');
      expect(users[0].createdAt).toBe('2024-01-01');
      
      expect('passwordHash' in users[0]).toBe(false);
    });

    it('returns correct types for UserResponse', async () => {
      const response = await request(app).get('/users');
      
      const user = response.body[0] as UserResponse;
      expect(user).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        bio: expect.any(String),
        createdAt: expect.any(String),
      });
    });
  });

  describe('GET /users/:id', () => {
    it('returns user by id', async () => {
      const response = await request(app).get('/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect('passwordHash' in response.body).toBe(false);
    });

    it('returns 404 for non-existent user', async () => {
      const response = await request(app).get('/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });
});
