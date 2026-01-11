import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { Entity } from '../../src/decorators/entity.js';
import { bootstrapEntities, getTableDefFromEntity } from '../../src/decorators/bootstrap.js';
import { col } from '../../src/schema/column-types.js';
import type { ColumnDef, TableDef, RelationDef } from '../../src/index.js';
import type { Dto, WithRelations, CreateDto, UpdateDto, SimpleWhereInput } from '../../src/dto/index.js';

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
  age?: number;

  @Column(col.default(col.boolean(), true))
  active?: boolean;

  @Column(col.text())
  bio?: string;

  @Column(col.default(col.timestamp(), { raw: 'NOW()' }))
  createdAt?: string;
}

@Entity()
class Post {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.text())
  content?: string;

  @Column(col.default(col.boolean(), false))
  published?: boolean;

  @Column(col.notNull(col.int()))
  authorId!: number;

  @Column(col.int())
  views?: number;

  @Column(col.default(col.timestamp(), { raw: 'NOW()' }))
  createdAt?: string;
}

type UserTable = TableDef<{
  id: ColumnDef<'INT', number>;
  name: ColumnDef<'VARCHAR', string>;
  email: ColumnDef<'VARCHAR', string>;
  passwordHash: ColumnDef<'VARCHAR', string>;
  age: ColumnDef<'INT', number>;
  active: ColumnDef<'BOOLEAN', boolean>;
  bio: ColumnDef<'TEXT', string>;
  createdAt: ColumnDef<'TIMESTAMP', string>;
}>;

type PostTable = TableDef<{
  id: ColumnDef<'INT', number>;
  title: ColumnDef<'VARCHAR', string>;
  content: ColumnDef<'TEXT', string>;
  published: ColumnDef<'BOOLEAN', boolean>;
  authorId: ColumnDef<'INT', number>;
  views: ColumnDef<'INT', number>;
  createdAt: ColumnDef<'TIMESTAMP', string>;
}>;

const userTable = getTableDefFromEntity(User)!;
const postTable = getTableDefFromEntity(Post)!;

type UserResponse = Dto<UserTable, 'passwordHash'>;
type PostResponse = Dto<PostTable, 'authorId'>;
type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
type CreateUserDto = CreateDto<UserTable>;
type UpdateUserDto = UpdateDto<UserTable, 'id' | 'createdAt'>;
type UserFilter = SimpleWhereInput<UserTable, 'name' | 'email' | 'age' | 'active'>;

const mockUsers: UserResponse[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, active: true, bio: 'Hello World', createdAt: '2024-01-01' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, active: true, bio: 'Developer', createdAt: '2024-01-02' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, active: false, bio: 'Designer', createdAt: '2024-01-03' },
];

const mockPosts: PostResponse[] = [
  { id: 1, title: 'First Post', content: 'Hello World', published: true, views: 100, createdAt: '2024-01-01' },
  { id: 2, title: 'Second Post', content: 'More content', published: false, views: 50, createdAt: '2024-01-02' },
  { id: 3, title: 'Third Post', content: 'Yet more', published: true, views: 200, createdAt: '2024-01-03' },
];

describe('DTO Express Integration with Decorated Entities', () => {
  let app: express.Express;

  beforeAll(() => {
    bootstrapEntities();
    app = express();
    app.use(express.json());

    app.get('/users', (req, res) => {
      res.json(mockUsers);
    });

    app.get('/users/search', (req, res) => {
      const filter = req.query as any;
      let results = [...mockUsers];
      
      const parsedFilter: UserFilter = {};
      
      if (filter.name_contains) {
        parsedFilter.name = { ...parsedFilter.name, contains: filter.name_contains };
      }
      if (filter.name_startsWith) {
        parsedFilter.name = { ...parsedFilter.name, startsWith: filter.name_startsWith };
      }
      if (filter.name_endsWith) {
        parsedFilter.name = { ...parsedFilter.name, endsWith: filter.name_endsWith };
      }
      if (filter.email_contains) {
        parsedFilter.email = { ...parsedFilter.email, contains: filter.email_contains };
      }
      if (filter.email_endsWith) {
        parsedFilter.email = { ...parsedFilter.email, endsWith: filter.email_endsWith };
      }
      if (filter.age_gt) {
        parsedFilter.age = { ...parsedFilter.age, gt: parseInt(filter.age_gt) };
      }
      if (filter.age_lt) {
        parsedFilter.age = { ...parsedFilter.age, lt: parseInt(filter.age_lt) };
      }
      if (filter.active_equals) {
        parsedFilter.active = { equals: filter.active_equals === 'true' };
      }
      
      if (parsedFilter.name?.contains) {
        results = results.filter(u => u.name.toLowerCase().includes(parsedFilter.name.contains!.toLowerCase()));
      }
      if (parsedFilter.name?.startsWith) {
        results = results.filter(u => u.name.toLowerCase().startsWith(parsedFilter.name.startsWith!.toLowerCase()));
      }
      if (parsedFilter.name?.endsWith) {
        results = results.filter(u => u.name.toLowerCase().endsWith(parsedFilter.name.endsWith!.toLowerCase()));
      }
      if (parsedFilter.email?.contains) {
        results = results.filter(u => u.email.toLowerCase().includes(parsedFilter.email.contains!.toLowerCase()));
      }
      if (parsedFilter.email?.endsWith) {
        results = results.filter(u => u.email.toLowerCase().endsWith(parsedFilter.email.endsWith!.toLowerCase()));
      }
      if (parsedFilter.age?.gt !== undefined) {
        results = results.filter(u => u.age! > parsedFilter.age.gt!);
      }
      if (parsedFilter.age?.lt !== undefined) {
        results = results.filter(u => u.age! < parsedFilter.age.lt!);
      }
      if (parsedFilter.active?.equals !== undefined) {
        results = results.filter(u => u.active === parsedFilter.active.equals);
      }
      
      res.json(results);
    });

    app.get('/users/:id', (req, res) => {
      const user = mockUsers.find(u => u.id === parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    });

    app.post('/users', (req, res) => {
      const body = req.body as any;
      const newUser: UserResponse = {
        id: mockUsers.length + 1,
        name: body.name,
        email: body.email,
        age: body.age,
        active: body.active ?? true,
        bio: body.bio ?? null,
        createdAt: new Date().toISOString(),
      } as any;
      mockUsers.push(newUser);
      res.status(201).json(newUser);
    });

    app.patch('/users/:id', (req, res) => {
      const id = parseInt(req.params.id);
      const body = req.body as UpdateUserDto;
      const userIndex = mockUsers.findIndex(u => u.id === id);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      const updated = { ...mockUsers[userIndex], ...body };
      mockUsers[userIndex] = updated;
      res.json(updated);
    });

    app.get('/users/:id/posts', (req, res) => {
      const userId = parseInt(req.params.id);
      const posts = mockPosts.filter(p => (p as any).authorId === userId);
      const user = mockUsers.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const response: UserWithPosts = {
        ...user,
        posts,
      };
      res.json(response);
    });

    app.get('/posts', (req, res) => {
      res.json(mockPosts);
    });

    app.get('/posts/:id', (req, res) => {
      const post = mockPosts.find(p => p.id === parseInt(req.params.id));
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.json(post);
    });
  });

  describe('GET /users', () => {
    it('returns all users without passwordHash', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
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

  describe('POST /users', () => {
    it('creates a new user with CreateDto', async () => {
      const newUser: CreateUserDto = {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        age: 28,
      };

      const response = await request(app).post('/users').send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'Alice Johnson',
        email: 'alice@example.com',
        age: 28,
        active: true,
      });
      expect('passwordHash' in response.body).toBe(false);
    });

    it('creates user with optional fields', async () => {
      const newUser: CreateUserDto = {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        age: 40,
        active: false,
        bio: 'Writer',
      };

      const response = await request(app).post('/users').send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Charlie Brown',
        active: false,
        bio: 'Writer',
      });
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates user with UpdateDto', async () => {
      const update: UpdateUserDto = {
        name: 'John Updated',
        age: 31,
      };

      const response = await request(app).patch('/users/1').send(update);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        name: 'John Updated',
        age: 31,
        email: 'john@example.com',
      });
    });

    it('partially updates user bio', async () => {
      const update: UpdateUserDto = {
        bio: 'Updated bio',
      };

      const response = await request(app).patch('/users/2').send(update);

      expect(response.status).toBe(200);
      expect(response.body.bio).toBe('Updated bio');
      expect(response.body.name).toBe('Jane Smith');
    });

    it('returns 404 when updating non-existent user', async () => {
      const update: UpdateUserDto = {
        name: 'Ghost',
      };

      const response = await request(app).patch('/users/999').send(update);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });

  describe('GET /users/:id/posts (WithRelations)', () => {
    it('returns user with nested posts using WithRelations', async () => {
      const response = await request(app).get('/users/2/posts');

      expect(response.status).toBe(200);
      const data = response.body as UserWithPosts;
      
      expect(data.id).toBe(2);
      expect(data.name).toBe('Jane Smith');
      expect(data.posts).toBeDefined();
      expect(Array.isArray(data.posts)).toBe(true);
      expect(data.posts.length).toBeGreaterThanOrEqual(0);
      
      if (data.posts.length > 0) {
        const post = data.posts[0];
        expect(post.id).toBeDefined();
        expect(post.title).toBeDefined();
        expect('authorId' in post).toBe(false);
      }
    });

    it('correctly types nested relations', async () => {
      const response = await request(app).get('/users/1/posts');
      const data = response.body as UserWithPosts;

      expect(data).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        posts: expect.any(Array),
      });
    });
  });

  describe('GET /posts', () => {
    it('returns all posts without authorId', async () => {
      const response = await request(app).get('/posts');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      const post = response.body[0] as PostResponse;
      expect(post.id).toBeDefined();
      expect(post.title).toBeDefined();
      expect(post.content).toBeDefined();
      expect(post.published).toBeDefined();
      expect(post.views).toBeDefined();
      expect('authorId' in post).toBe(false);
    });
  });

  describe('GET /posts/:id', () => {
    it('returns post by id without authorId', async () => {
      const response = await request(app).get('/posts/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        title: 'First Post',
        content: 'Hello World',
      });
      expect('authorId' in response.body).toBe(false);
    });
  });

  describe('GET /users/search (SimpleWhereInput)', () => {
    it('filters users by name contains', async () => {
      const response = await request(app).get('/users/search?name_contains=John');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toMatch(/john/i);
    });

    it('filters users by email endsWith', async () => {
      const response = await request(app).get('/users/search?email_endsWith=@example.com');

      expect(response.status).toBe(200);
      response.body.forEach((user: UserResponse) => {
        expect(user.email).toMatch(/@example\.com$/);
      });
    });

    it('filters users by age gt', async () => {
      const response = await request(app).get('/users/search?age_gt=28');

      expect(response.status).toBe(200);
      response.body.forEach((user: UserResponse) => {
        expect(user.age).toBeGreaterThan(28);
      });
    });

    it('filters users by active equals', async () => {
      const response = await request(app).get('/users/search?active_equals=true');

      expect(response.status).toBe(200);
      response.body.forEach((user: UserResponse) => {
        expect(user.active).toBe(true);
      });
    });

    it('combines multiple filters', async () => {
      const response = await request(app).get('/users/search?name_contains=John&age_gt=25&active_equals=true');

      expect(response.status).toBe(200);
      response.body.forEach((user: UserResponse) => {
        expect(user.name).toMatch(/john/i);
        expect(user.age).toBeGreaterThan(25);
        expect(user.active).toBe(true);
      });
    });

    it('returns all users when no filters provided', async () => {
      const response = await request(app).get('/users/search');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });
  });
});
