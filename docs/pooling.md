# Connection Pooling with MetalORM (first-class)

MetalORM ships a built-in, driver-agnostic pool plus a safe `DbExecutorFactory` implementation.

Key properties:

- **No leaks by default**: pool leases are released in `finally`.
- **Correct transactions**: one leased connection per transaction.
- **Deterministic shutdown**: call `await orm.dispose()`.

## Example: PostgreSQL (`pg` Client) using MetalORM Pool

```ts
import { Client } from 'pg';
import { Orm, PostgresDialect, Pool, createPooledExecutorFactory } from 'metal-orm';

const pool = new Pool(
  {
    async create() {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      return client;
    },
    async destroy(client) {
      await client.end();
    },
  },
  {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30_000,
    acquireTimeoutMillis: 10_000,
  }
);

const executorFactory = createPooledExecutorFactory({
  pool,
  adapter: {
    async query(conn, sql, params) {
      const res = await conn.query(sql, params as any[]);
      return res.rows;
    },
    beginTransaction: conn => conn.query('BEGIN').then(() => undefined),
    commitTransaction: conn => conn.query('COMMIT').then(() => undefined),
    rollbackTransaction: conn => conn.query('ROLLBACK').then(() => undefined),
  },
});

const orm = new Orm({
  dialect: new PostgresDialect(),
  executorFactory,
});

// ... use orm ...

await orm.dispose();
```

Notes:

- `executorFactory.createExecutor()` supports transactions without holding a connection forever: a connection is leased only while inside a transaction.
- `executorFactory.createTransactionalExecutor()` uses a sticky leased connection for the whole session (useful for `Orm.transaction`).

## Example: MySQL/MariaDB (`mysql2/promise`)

The same pattern applies: adapt a single-connection client into `query/begin/commit/rollback`, and use MetalORM’s `Pool`.

## Example: SQL Server

Use the same approach with a “single connection” abstraction and an adapter that executes SQL + begin/commit/rollback.

If your driver already provides a stable per-connection API, it’s straightforward to wrap it.
