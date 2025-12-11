# Level 3 Tutorial: Decorator Entities + OrmSession

This tutorial builds a small blog-style HTTP API (users, posts, tags) using MetalORM's **Level 3** decorator layer and the high-level `OrmSession` Unit of Work. It covers:

- Generating decorator entities from an existing database with `scripts/generate-entities.mjs` or writing them by hand.
- Bootstrapping metadata, emitting DDL, and wiring request-scoped sessions.
- Driver setups for PostgreSQL, MySQL, SQLite, and SQL Server.
- Querying and mutating entities with a single `commit()`.

> Samples use TypeScript with ESM. Adjust imports if you prefer CJS.

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

And create a `.env` file with your database URL (pick one):

```dotenv
DATABASE_URL=postgres://user:pass@localhost:5432/metalorm_blog
```

## 2) Install dependencies

```bash
npm install metal-orm express dotenv
# Add ONE driver:
npm install pg              # PostgreSQL
npm install mysql2          # MySQL/MariaDB
npm install sqlite3         # SQLite
npm install tedious         # SQL Server (MSSQL)
```

Requirements:

- Node 18+
- A database URL for your target dialect

## 3) Generate or author decorator entities

You can reverse-engineer entities from a live database or write them manually.

### Option A: Generate with `scripts/generate-entities.mjs` (recommended when a schema already exists)

The script introspects a running database and emits decorated classes plus a helper to bootstrap tables.

Flags:

- `--dialect` (`postgres` | `mysql` | `sqlite` | `mssql`, default `postgres`)
- `--url` connection string (not needed for SQLite; falls back to `DATABASE_URL`)
- `--db` SQLite file path (defaults to `:memory:`)
- `--schema` schema/database name (optional, dialect-specific)
- `--include` / `--exclude` comma-separated table filters
- `--out` output path (default `generated-entities.ts`)
- `--dry-run` print to stdout instead of writing a file

Usage per dialect:

```bash
# PostgreSQL
node scripts/generate-entities.mjs --dialect=postgres --url=$DATABASE_URL --schema=public --out=src/entities.ts

# MySQL / MariaDB
node scripts/generate-entities.mjs --dialect=mysql --url=$DATABASE_URL --schema=mydb --exclude=flyway_schema_history --out=src/entities.ts

# SQLite
node scripts/generate-entities.mjs --dialect=sqlite --db=./app.db --out=src/entities.ts

# SQL Server (MSSQL)
node scripts/generate-entities.mjs --dialect=mssql --url="$DATABASE_URL" --schema=dbo --include=Users,Posts,Tags --out=src/entities.ts
```

The generated file includes:

- Decorated classes for each table (PKs, FKs, pivot relations inferred).
- `bootstrapEntityTables()` returning a map of `TableDef`s keyed by class name.
- `allTables()` returning an array of all `TableDef`s (useful for schema generation).

Regenerate after schema changes to stay in sync.

### Option B: Write entities manually

Create `src/entities.ts` and describe your model with decorators. The column names are taken directly from the property names, so use the exact casing you want in SQL.

```ts
import { col, HasManyCollection, ManyToManyCollection, BelongsToReference } from 'metal-orm';
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
  posts!: HasManyCollection<Post>;
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
  author!: BelongsToReference<User>;

  @BelongsToMany({
    target: () => Tag,
    pivotTable: () => PostTag,
    pivotForeignKeyToRoot: 'post_id',
    pivotForeignKeyToTarget: 'tag_id',
    cascade: 'link',
  })
  tags!: ManyToManyCollection<Tag>;
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

## 4) Create the tables (DDL)

You can hand-write SQL or generate it from decorator metadata. If you used the generator script, prefer its helpers.

`scripts/bootstrap-schema.ts` (works for all dialects—swap the driver + schema dialect):

```ts
import dotenv from 'dotenv';
import { generateSchemaSql, PostgresSchemaDialect, MySqlSchemaDialect, SQLiteSchemaDialect, MSSqlSchemaDialect } from 'metal-orm';
import { bootstrapEntityTables, allTables } from '../src/entities.js'; // generated file exports these
// If you authored entities manually, call bootstrapEntities() + getTableDefFromEntity instead.

dotenv.config();

const dialect = new PostgresSchemaDialect(); // switch to MySqlSchemaDialect / SQLiteSchemaDialect / MSSqlSchemaDialect
const tables = allTables(); // or Object.values(bootstrapEntityTables())
const statements = generateSchemaSql(tables, dialect);

async function run() {
  // PostgreSQL example
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
    }
    console.log('Schema created');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```

Swap the driver block for other databases:

- MySQL/MariaDB: `import { createPool } from 'mysql2/promise'; await pool.query(sql);`
- SQLite: `import sqlite3 from 'sqlite3'; db.run(sql);`
- SQL Server: `import { Connection, Request } from 'tedious';` then execute each statement with a `Request`.

## 5) Bootstrap metadata once

`getTableDefFromEntity()` / `selectFromEntity()` will now lazy-bootstrap when the table isn't built yet, but it's still better to bootstrap explicitly once so you reuse the same `TableDef` instances everywhere (and have them handy for schema generation). If you used the generator, it already exports a `bootstrapEntityTables()` helper.

```ts
// src/db-tables.ts
import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm/decorators';
import { User, Post, Tag, PostTag } from './entities.js';

bootstrapEntities();

export const usersTable = getTableDefFromEntity(User)!;
export const postsTable = getTableDefFromEntity(Post)!;
export const tagsTable = getTableDefFromEntity(Tag)!;
export const postTagsTable = getTableDefFromEntity(PostTag)!;
```

## 6) Request-scoped sessions (PostgreSQL, MySQL, SQLite, SQL Server)

`OrmSession` is the DRY, high-level Unit of Work: it handles hydration, change tracking, relation updates, domain events, and flush ordering. The pattern below keeps a single DB connection per session, releases it when the request finishes, and works across all four dialects.

First, a tiny factory that stitches together a dialect and a driver-specific connector:

```ts
// src/session-factory.ts
import { Orm, OrmSession } from 'metal-orm';
import type { DbExecutor } from 'metal-orm';

type Connector = () => Promise<{ executor: DbExecutor; cleanup: () => Promise<void> }>;

export const createSessionFactory = (dialect: any, connect: Connector) => {
  const orm = new Orm({
    dialect,
    executorFactory: {
      createExecutor() {
        throw new Error('Use the request-scoped connector instead of the default factory.');
      },
      createTransactionalExecutor() {
        throw new Error('Use the request-scoped connector instead of the default factory.');
      },
    },
  });

  return async () => {
    const { executor, cleanup } = await connect();
    const session = new OrmSession({ orm, executor });
    return { session, cleanup };
  };
};
```

Then, pick ONE connector below (keep only the one you need):

```ts
// src/session-postgres.ts
import { Pool } from 'pg';
import { PostgresDialect, createPostgresExecutor } from 'metal-orm';
import { createSessionFactory } from './session-factory.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const openSession = createSessionFactory(new PostgresDialect(), async () => {
  const client = await pool.connect();
  return {
    executor: createPostgresExecutor(client),
    cleanup: async () => client.release(),
  };
});
```

SQL Server needs the `tedious` driver, but `metal-orm` now exports `createTediousMssqlClient`
to adapt a `Connection` plus `Request`/`TYPES` into the `createMssqlExecutor` shape and
`createTediousExecutor` to compose that adapter with the executor. Keep your connector focused
on opening/closing the connection while the adapter handles parameters and row hydration.

```ts
// src/session-mysql.ts
import mysql from 'mysql2/promise';
import { MySqlDialect, createMysqlExecutor } from 'metal-orm';
import { createSessionFactory } from './session-factory.js';

const pool = mysql.createPool(process.env.DATABASE_URL!);

export const openSession = createSessionFactory(new MySqlDialect(), async () => {
  const conn = await pool.getConnection();
  return {
    executor: createMysqlExecutor(conn),
    cleanup: async () => conn.release(),
  };
});
```

```ts
// src/session-sqlite.ts
import sqlite3 from 'sqlite3';
import { SQLiteDialect, createSqliteExecutor } from 'metal-orm';
import { createSessionFactory } from './session-factory.js';

const dbPath = process.env.DATABASE_URL ?? './app.db';

export const openSession = createSessionFactory(new SQLiteDialect(), async () => {
  const db = new sqlite3.Database(dbPath);
  const all = (sql: string, params: unknown[] = []) =>
    new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

  return {
    executor: createSqliteExecutor({
      all,
      beginTransaction: () => all('BEGIN'),
      commitTransaction: () => all('COMMIT'),
      rollbackTransaction: () => all('ROLLBACK'),
    }),
    cleanup: () =>
      new Promise<void>((resolve, reject) => db.close(err => (err ? reject(err) : resolve()))),
  };
});
```

```ts
// src/session-mssql.ts
import { Connection, Request, TYPES } from 'tedious';
import {
  SqlServerDialect,
  createTediousExecutor,
} from 'metal-orm';
import { createSessionFactory } from './session-factory.js';

const toMssqlConfig = (connection: string) => {
  const url = new URL(connection);
  return {
    server: url.hostname,
    authentication: {
      type: 'default',
      options: {
        userName: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
      },
    },
    options: {
      database: url.pathname.replace(/^\//, ''),
      port: url.port ? Number(url.port) : undefined,
      encrypt: url.searchParams.get('encrypt') === 'true',
    },
  };
};

export const openSession = createSessionFactory(
  new SqlServerDialect(),
  async () => {
    const connection = new Connection(
      toMssqlConfig(process.env.DATABASE_URL!),
    );

    await new Promise<void>((resolve, reject) => {
      connection.once('connect', err => (err ? reject(err) : resolve()));
      connection.once('error', reject);
      connection.connect();
    });

    const executor = createTediousExecutor(connection, { Request, TYPES });

    return {
      executor,
      cleanup: () =>
        new Promise<void>((resolve, reject) => {
          connection.once('end', resolve);
          connection.once('error', reject);
          connection.close();
        }),
    };
  },
);
```

> Keep only the connector you use in production to avoid bundling unused drivers.

## 7) Data access helpers (entities + relations)

Use `OrmSession` directly with decorator-aware helpers. It acts as both the execution context and the EntityContext for mutation tracking.

`src/blog-service.ts`:

```ts
import crypto from 'node:crypto';
import { OrmSession, createEntityFromRow, eq } from 'metal-orm';
import { selectFromEntity } from 'metal-orm/decorators';
import { esel } from 'metal-orm/query-builder/select-helpers.js';
import { User, Post, Tag } from './entities.js';
import { postsTable, tagsTable } from './db-tables.js';

export async function listPosts(session: OrmSession) {
  const postSelection = esel(Post, 'id', 'title', 'body', 'published');
  const authorSelection = esel(User, 'id', 'email', 'name');
  const tagSelection = esel(Tag, 'id', 'name');

  return selectFromEntity(Post)
    .select(postSelection)
    .include('author', { columns: Object.keys(authorSelection) })
    .include('tags', { columns: Object.keys(tagSelection) })
    .orderBy(postsTable.columns.id, 'DESC')
    .execute(session);
}

export async function createPost(session: OrmSession, input: {
  title: string;
  body: string;
  authorId: string;
  tagIds?: string[];
}) {
  const post = createEntityFromRow(session, postsTable, {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    author_id: input.authorId,
    published: false,
  });

  if (input.tagIds?.length) {
    await post.tags.syncByIds(input.tagIds);
  }

  await session.commit();
  return post;
}

export async function updatePost(
  session: OrmSession,
  postId: string,
  input: { title?: string; body?: string; tagIds?: string[] }
) {
  const [post] = await selectFromEntity(Post)
    .selectColumns('id', 'title', 'body')
    .where(eq(postsTable.columns.id, postId))
    .execute(session);

  if (!post) throw new Error('Post not found');
  if (input.title !== undefined) post.title = input.title;
  if (input.body !== undefined) post.body = input.body;
  if (input.tagIds) await post.tags.syncByIds(input.tagIds);

  await session.commit();
  return post;
}

export async function deletePost(session: OrmSession, postId: string) {
  const [post] = await selectFromEntity(Post)
    .selectColumns('id')
    .where(eq(postsTable.columns.id, postId))
    .execute(session);

  if (!post) throw new Error('Post not found');
  session.markRemoved(post);
  await session.commit();
}

export async function publishPost(session: OrmSession, postId: string) {
  const [post] = await selectFromEntity(Post)
    .selectColumns('id', 'published')
    .where(eq(postsTable.columns.id, postId))
    .execute(session);

  if (!post) throw new Error('Post not found');
  post.published = true;
  await session.commit();
  return post;
}
```

Key takeaways:

- `selectFromEntity(...).execute(session)` hydrates tracked entities; relations stay lazy unless included.
- `createEntityFromRow(session, table, data)` creates a tracked entity (status = New) that flushes on `commit()`.
- Relation helpers like `syncByIds()` register pivot/foreign-key changes; `commit()` flushes both entities and relation diffs.
- `OrmSession` doubles as the `EntityContext`, so no extra conversion is needed for manual entity creation.
- `esel()` lets you build typed selection maps from entity constructors; reuse `Object.keys(esel(...))` to feed relation column lists into `include` without hand-typing column names.

### Optional: Base repository helper (keeps controllers thin)

```ts
import {
  OrmSession,
  createEntityProxy,
  eq,
  TableDef,
  ColumnDef,
} from 'metal-orm';
import {
  selectFromEntity,
  getTableDefFromEntity,
  EntityConstructor,
} from 'metal-orm/decorators';

const selectAll = (table: TableDef) => {
  const selection: Record<string, ColumnDef> = {};
  for (const key in table.columns) selection[key] = table.columns[key];
  return selection;
};

const getPrimaryKey = (table: TableDef) => {
  if (table.primaryKey?.length) return table.primaryKey[0];
  const pk = Object.values(table.columns).find(c => c.primary);
  return pk ? pk.name : 'id';
};

export class BaseRepository<T> {
  protected table: TableDef;
  protected pk: string;

  constructor(protected session: OrmSession, protected ctor: EntityConstructor) {
    const def = getTableDefFromEntity(ctor);
    if (!def) throw new Error(`Entity ${ctor.name} not bootstrapped.`);
    this.table = def;
    this.pk = getPrimaryKey(this.table);
  }

  async findAll(options?: {
    include?: string[];
    orderBy?: { col: string; dir: 'ASC' | 'DESC' };
    columns?: Record<string, ColumnDef>;
  }) {
    let qb = selectFromEntity(this.ctor).select(options?.columns ?? selectAll(this.table));
    for (const rel of options?.include ?? []) qb = qb.include(rel);
    if (options?.orderBy) {
      qb = qb.orderBy(this.table.columns[options.orderBy.col], options.orderBy.dir);
    }
    return qb.execute(this.session) as Promise<T[]>;
  }

  async findById(id: string | number, options?: { include?: string[] }) {
    let qb = selectFromEntity(this.ctor)
      .select(selectAll(this.table))
      .where(eq(this.table.columns[this.pk], id));
    for (const rel of options?.include ?? []) qb = qb.include(rel);
    const [result] = await qb.execute(this.session);
    return (result as T) || null;
  }

  create(data: Partial<T>) {
    const entity = createEntityProxy(this.session, this.table, data as any);
    const pkValue = (data as any)[this.pk];
    this.session.trackNew(this.table, entity, pkValue);
    return entity as T;
  }

  async update(id: string | number, data: Partial<T>) {
    const entity = await this.findById(id);
    if (!entity) throw new Error(`${this.table.name} with ID ${id} not found`);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) (entity as any)[key] = value;
    }
    await this.session.commit();
    return entity;
  }

  async delete(id: string | number) {
    const pkCol = this.table.columns[this.pk];
    const [entity] = await selectFromEntity(this.ctor)
      .select({ [this.pk]: pkCol })
      .where(eq(pkCol, id))
      .execute(this.session);

    if (entity) {
      this.session.markRemoved(entity);
      await this.session.commit();
    }
  }
}
```

## 8) HTTP API wiring (Express)

Create a per-request session from the connector you chose, release the DB connection after the response, and let each route call your service functions.

`src/server.ts`:

```ts
import express from 'express';
import dotenv from 'dotenv';
import { openSession } from './session-postgres.js'; // or session-mysql / session-sqlite / session-mssql
import { listPosts, createPost, publishPost, updatePost, deletePost } from './blog-service.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use(async (req, res, next) => {
  const { session, cleanup } = await openSession();
  (req as any).session = session;
  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
});

app.get('/posts', async (req, res, next) => {
  try {
    const posts = await listPosts((req as any).session);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

app.post('/posts', async (req, res, next) => {
  try {
    const post = await createPost((req as any).session, {
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

app.patch('/posts/:id', async (req, res, next) => {
  try {
    const post = await updatePost((req as any).session, req.params.id, {
      title: req.body.title,
      body: req.body.body,
      tagIds: req.body.tagIds,
    });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

app.delete('/posts/:id', async (req, res, next) => {
  try {
    await deletePost((req as any).session, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.post('/posts/:id/publish', async (req, res, next) => {
  try {
    const post = await publishPost((req as any).session, req.params.id);
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

## 9) Next steps

- Add `beforeInsert`/`afterUpdate` hooks to entities (via `Entity({ hooks })`) for auditing or soft deletes.
- Register domain event handlers on the `OrmSession` to emit application events after `commit()`.
- Swap `include()` for `includeLazy()` if you want smaller payloads and on-demand loading for heavy relations.
- Build a frontend for this API by following the companion guide: `docs/level-3-front-tutorial.md`.
