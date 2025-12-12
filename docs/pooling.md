# Connection Pooling with MetalORM

MetalORM leaves pooling to your executor factory so you can match your driver and deployment needs. Here’s a practical pattern.

## Principles

- **Per-transaction connection**: `createTransactionalExecutor` should grab a dedicated connection from the pool and release it after commit/rollback.
- **Non-transactional executor**: `createExecutor` can reuse a pooled connection or create a short-lived one per call—just be consistent and release it.
- **Always release on error**: ensure rollback paths also release the connection.

## Example: PostgreSQL (`pg` pool)

```ts
import { Pool } from 'pg';
import { PostgresDialect } from 'metal-orm';
import { Orm } from 'metal-orm';
import { createExecutorFromQueryRunner } from 'metal-orm/core/execution/db-executor';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

const orm = new Orm({
  dialect: new PostgresDialect(),
  executorFactory: {
    // For ad-hoc/non-transactional calls
    createExecutor: () => {
      const clientPromise = pool.connect();
      const runner = {
        async query(sql: string, params?: unknown[]) {
          const client = await clientPromise;
          return client.query(sql, params).then(res => res.rows);
        },
        release: async () => (await clientPromise).release(),
      };
      // Optionally release after use; for simple cases you might release here.
      return createExecutorFromQueryRunner(runner);
    },
    // For scoped transactions
    createTransactionalExecutor: () => {
      let client: PoolClient | null = null;
      const getClient = async () => {
        if (client) return client;
        client = await pool.connect();
        return client;
      };

      const runner = {
        async query(sql: string, params?: unknown[]) {
          const c = await getClient();
          return c.query(sql, params).then(res => res.rows);
        },
        async beginTransaction() {
          const c = await getClient();
          await c.query('BEGIN');
        },
        async commitTransaction() {
          if (!client) return;
          await client.query('COMMIT');
          client.release();
          client = null;
        },
        async rollbackTransaction() {
          if (!client) return;
          await client.query('ROLLBACK');
          client.release();
          client = null;
        },
      };

      return createExecutorFromQueryRunner(runner);
    },
  },
});
```

Swap in your driver as needed (`mysql2`, `tedious`, etc.)—the key is to scope one connection per transaction and release it on both success and failure.

## Example: MySQL/MariaDB (`mysql2/promise` pool)

```ts
import mysql from 'mysql2/promise';
import { MySqlDialect } from 'metal-orm';
import { Orm } from 'metal-orm';
import { createExecutorFromQueryRunner } from 'metal-orm/core/execution/db-executor';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
  waitForConnections: true,
});

const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: {
    createExecutor: () => {
      // grab/release per call (simple usage)
      const runner = {
        async query(sql: string, params?: unknown[]) {
          const [rows] = await pool.query(sql, params);
          return rows as Array<Record<string, unknown>>;
        },
      };
      return createExecutorFromQueryRunner(runner);
    },
    createTransactionalExecutor: () => {
      let conn: mysql.PoolConnection | null = null;
      const getConn = async () => (conn ? conn : (conn = await pool.getConnection()));

      const runner = {
        async query(sql: string, params?: unknown[]) {
          const c = await getConn();
          const [rows] = await c.query(sql, params);
          return rows as Array<Record<string, unknown>>;
        },
        async beginTransaction() {
          const c = await getConn();
          await c.beginTransaction();
        },
        async commitTransaction() {
          if (!conn) return;
          await conn.commit();
          conn.release();
          conn = null;
        },
        async rollbackTransaction() {
          if (!conn) return;
          await conn.rollback();
          conn.release();
          conn = null;
        },
      };

      return createExecutorFromQueryRunner(runner);
    },
  },
});
```

## Example: SQL Server (Tedious + pool wrapper)

```ts
import { ConnectionPool } from 'tedious-connection-pool2';
import { Connection, Request, TYPES } from 'tedious';
import { MSSQLDialect, createTediousExecutor } from 'metal-orm';
import { Orm } from 'metal-orm';

const pool = new ConnectionPool({
  min: 2,
  max: 10,
  log: false,
}, {
  server: process.env.DB_HOST!,
  userName: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  options: { database: process.env.DB_NAME!, encrypt: true },
});

const orm = new Orm({
  dialect: new MSSQLDialect(),
  executorFactory: {
    createExecutor: () => {
      const connPromise = new Promise<Connection>((resolve, reject) => {
        pool.acquire((err, conn) => (err ? reject(err) : resolve(conn)));
      });
      return createTediousExecutor({
        execSql: async (req) => (await connPromise).execSql(req),
      } as any, { Request, TYPES });
    },
    createTransactionalExecutor: () => {
      let conn: Connection | null = null;
      const getConn = async () => {
        if (conn) return conn;
        conn = await new Promise<Connection>((resolve, reject) => {
          pool.acquire((err, c) => (err ? reject(err) : resolve(c)));
        });
        return conn;
      };
      const executor = createTediousExecutor({
        execSql: async (req) => (await getConn()).execSql(req),
        beginTransaction: (cb) => getConn().then(c => c.beginTransaction(cb)),
        commitTransaction: (cb) => getConn().then(c => c.commitTransaction(cb)),
        rollbackTransaction: (cb) => getConn().then(c => c.rollbackTransaction(cb)),
      } as any, { Request, TYPES });

      // release after commit/rollback
      const release = () => {
        if (conn) {
          conn.close();
          conn = null;
        }
      };
      const wrapped = {
        ...executor,
        async commitTransaction() {
          await executor.commitTransaction?.();
          release();
        },
        async rollbackTransaction() {
          await executor.rollbackTransaction?.();
          release();
        },
      };
      return wrapped;
    },
  },
});
```
