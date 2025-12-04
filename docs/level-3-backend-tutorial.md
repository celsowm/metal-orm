# Level 3 Tutorial: Decorator Entities in a Backend API

This tutorial builds a small blog-style HTTP API (users, posts, tags) using MetalORM's **Level 3** decorator layer plus the runtime/Unit of Work. You'll:

- Describe your schema with decorators and bootstrap it into `TableDef`s.
- Plug an `OrmContext` into a real driver (PostgreSQL via `pg` in this example).
- Work with entities and relations and persist changes with a single `saveChanges()`.
- Expose the workflow over HTTP with Express.

> The code samples use TypeScript with ESM. Adjust imports if you prefer CJS.

## 1) Bootstrap a fresh project (if starting from scratch)

Already have a project? Skip to the next section. Otherwise:

```bash
mkdir blog-api && cd blog-api
npm init -y
npm pkg set type=module
npm install -D typescript tsx @types/node
npx tsc --init --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir dist
```

Add handy scripts to `package.json`:

```jsonc
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc"
  }
}
```

And create a `.env` file with your database URL:

```dotenv
DATABASE_URL=postgres://user:pass@localhost:5432/metalorm_blog
```

## 2) Install dependencies

```bash
npm install metal-orm pg express dotenv
```

Requirements:

- Node 18+
- A PostgreSQL database URL in `DATABASE_URL`


## 3) Define decorator entities

Create `src/entities.ts` and describe your model with decorators. The column names are taken directly from the property names, so use the exact casing you want in SQL.

```ts
import { col } from 'metal-orm';
import {
  Entity,
  Column,
  PrimaryKey,
  HasMany,
  BelongsTo,
  BelongsToMany,
} from 'metal-orm/decorators';

@Entity()
export class User {
  @PrimaryKey(col.varchar(36))
  id!: string;

  @Column(col.varchar(180))
  email!: string;

  @Column(col.varchar(120))
  name!: string;

  @HasMany({ target: () => Post, foreignKey: 'author_id', cascade: 'all' })
  posts!: any;
}

@Entity()
export class Post {
  @PrimaryKey(col.varchar(36))
  id!: string;

  @Column(col.varchar(160))
  title!: string;

  @Column({ type: 'TEXT', notNull: true })
  body!: string;

  @Column(col.varchar(36))
  author_id!: string;

  @Column({ type: 'BOOLEAN', notNull: true })
  published!: boolean;

  @BelongsTo({ target: () => User, foreignKey: 'author_id' })
  author!: any;

  @BelongsToMany({
    target: () => Tag,
    pivotTable: () => PostTag,
    pivotForeignKeyToRoot: 'post_id',
    pivotForeignKeyToTarget: 'tag_id',
    cascade: 'link',
  })
  tags!: any;
}

@Entity()
export class Tag {
  @PrimaryKey(col.varchar(36))
  id!: string;

  @Column(col.varchar(60))
  name!: string;
}

@Entity({ tableName: 'post_tags' })
export class PostTag {
  @PrimaryKey(col.varchar(36))
  id!: string;

  @Column(col.varchar(36))
  post_id!: string;

  @Column(col.varchar(36))
  tag_id!: string;
}
```

Notes:

- UUID strings are used for primary keys so you don't rely on database-generated IDs (the runtime does not auto-fill PKs from `RETURNING` yet).
- `cascade: 'link'` on the many-to-many relation means MetalORM will manage only the pivot rows when you sync/attach/detach tags.

## 4) Create the tables

You can hand-write SQL or generate it from the decorator metadata.

**Option A: Hand-written SQL (PostgreSQL)**

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE posts (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  author_id VARCHAR(36) NOT NULL REFERENCES users(id),
  published BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE tags (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id VARCHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (post_id, tag_id)
);
```

**Option B: Generate DDL from your entities (recommended for DRY)**

Create a one-off script (e.g., `scripts/bootstrap-schema.ts`) and run it with `tsx`:

```ts
import { Pool } from 'pg';
import { generateSchemaSql, PostgresSchemaDialect } from 'metal-orm';
import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm/decorators';
import { User, Post, Tag, PostTag } from '../src/entities.js';

bootstrapEntities();

const tables = [
  getTableDefFromEntity(User)!,
  getTableDefFromEntity(Post)!,
  getTableDefFromEntity(Tag)!,
  getTableDefFromEntity(PostTag)!,
];

const dialect = new PostgresSchemaDialect();
const statements = generateSchemaSql(tables, dialect);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
    }
    console.log('Schema created');
  } finally {
    client.release();
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

Swap `PostgresSchemaDialect` + `pg` for another dialect/driver if you use MySQL, SQLite, or MSSQL.

## 5) Bootstrap metadata and wire the database executor

Run `bootstrapEntities()` once at startup to turn decorator metadata into `TableDef`s, then create an `OrmContext` per request that uses a scoped PostgreSQL client and the `PostgresDialect`.

`src/db.ts`:

```ts
import { Pool } from 'pg';
import { OrmContext, PostgresDialect, DbExecutor } from 'metal-orm';
import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm/decorators';
import { User, Post, Tag } from './entities.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dialect = new PostgresDialect();

// Builds the TableDef objects from decorators (call after importing entities)
bootstrapEntities();

export const usersTable = getTableDefFromEntity(User)!;
export const postsTable = getTableDefFromEntity(Post)!;
export const tagsTable = getTableDefFromEntity(Tag)!;

export async function createRequestContext() {
  const client = await pool.connect();

  const executor: DbExecutor = {
    async executeSql(sql, params) {
      const result = await client.query(sql, params);
      return [
        {
          columns: result.fields.map(f => f.name),
          values: result.rows.map(row => result.fields.map(f => row[f.name])),
        },
      ];
    },
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commitTransaction() {
      await client.query('COMMIT');
    },
    async rollbackTransaction() {
      await client.query('ROLLBACK');
    },
  };

  const ctx = new OrmContext({ dialect, executor });
  return {
    ctx,
    release: () => client.release(),
  };
}
```

## 6) Data access helpers (entities + relations)

Use the decorator-aware helpers to query and mutate your graph. Notice how `selectFromEntity()` gives you a query builder and `createEntityFromRow()` creates tracked entities that `saveChanges()` can flush.

`src/blog-service.ts`:

```ts
import crypto from 'node:crypto';
import { OrmContext, createEntityFromRow, eq } from 'metal-orm';
import { selectFromEntity } from 'metal-orm/decorators';
import { User, Post, Tag } from './entities.js';
import { usersTable, postsTable, tagsTable } from './db.js';

export async function listPosts(ctx: OrmContext) {
  return selectFromEntity(Post)
    .select({
      id: postsTable.columns.id,
      title: postsTable.columns.title,
      body: postsTable.columns.body,
      published: postsTable.columns.published,
    })
    .include('author', {
      columns: [usersTable.columns.id, usersTable.columns.email, usersTable.columns.name],
    })
    .include('tags', {
      columns: [tagsTable.columns.id, tagsTable.columns.name],
    })
    .orderBy(postsTable.columns.id, 'DESC')
    .execute(ctx);
}

export async function createPost(ctx: OrmContext, input: {
  title: string;
  body: string;
  authorId: string;
  tagIds?: string[];
}) {
  const post = createEntityFromRow(ctx, postsTable, {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    author_id: input.authorId,
    published: false,
  });

  if (input.tagIds?.length) {
    await post.tags.syncByIds(input.tagIds);
  }

  await ctx.saveChanges();
  return post;
}

export async function publishPost(ctx: OrmContext, postId: string) {
  const [post] = await selectFromEntity(Post)
    .select({
      id: postsTable.columns.id,
      published: postsTable.columns.published,
    })
    .where(eq(postsTable.columns.id, postId))
    .execute(ctx);

  if (!post) {
    throw new Error('Post not found');
  }

  post.published = true;
  await ctx.saveChanges();
  return post;
}
```

Key takeaways:

- `createEntityFromRow()` creates a tracked entity (status = New) that will be inserted on `saveChanges()`.
- Relation helpers like `syncByIds()` register changes for the pivot table; you still flush once with `ctx.saveChanges()`.
- `include()` hydrates nested relations for read endpoints; use `includeLazy()` if you prefer on-demand loads instead.

## 7) HTTP API wiring (Express)

Finally, expose the service over HTTP. Create a per-request `OrmContext`, release the DB client after the response, and let each route call your service functions.

`src/server.ts`:

```ts
import express from 'express';
import dotenv from 'dotenv';
import { createRequestContext } from './db.js';
import { listPosts, createPost, publishPost } from './blog-service.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use(async (req, res, next) => {
  const { ctx, release } = await createRequestContext();
  (req as any).ctx = ctx;
  res.on('finish', release);
  res.on('close', release);
  next();
});

app.get('/posts', async (req, res, next) => {
  try {
    const posts = await listPosts((req as any).ctx);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

app.post('/posts', async (req, res, next) => {
  try {
    const post = await createPost((req as any).ctx, {
      title: req.body.title,
      body: req.body.body,
      authorId: req.body.authorId,
      tagIds: req.body.tagIds ?? [],
    });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

app.post('/posts/:id/publish', async (req, res, next) => {
  try {
    const post = await publishPost((req as any).ctx, req.params.id);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected error' });
});

app.listen(3000, () => {
  console.log('API running on http://localhost:3000');
});
```

## 8) Next steps

- Add `beforeInsert`/`afterUpdate` hooks to entities (via `Entity({ hooks })`) for auditing or soft deletes.
- Register domain event handlers on the `OrmContext` to emit application events after `saveChanges()`.
- Swap `include()` for `includeLazy()` if you want smaller payloads and on-demand loading for heavy relations.
- Build a frontend for this API by following the companion guide: `docs/level-3-front-tutorial.md`.
