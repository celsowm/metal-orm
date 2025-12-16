# Transactions

MetalORM supports database transactions through the executor abstraction and the ORM runtime. The key idea is simple: **transactions are provided by your `DbExecutor`**, and MetalORM will use them when available.

This doc explains:

- How executors expose transactions.
- How to run manual transactions (Level 1).
- How `OrmSession.commit()` and `Orm.transaction()` behave (Level 2/3).
- How to handle rollbacks and common pitfalls.

## Transaction support is executor-level

The low-level executor interface is:

```ts
export interface DbExecutor {
  readonly capabilities: {
    transactions: boolean;
  };

  executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;

  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  dispose(): Promise<void>;
}
```

MetalORM uses `capabilities.transactions` to decide whether a block should be wrapped in a transaction. Executors must still implement the transaction methods, but they can throw if transactions are not supported.

Built-in executor factories like `createMysqlExecutor`, `createPostgresExecutor`, `createSqliteExecutor`, and `createMssqlExecutor` adapt common drivers and forward their transaction methods into this shape.

## Level 1 (query builder): manual transactions

When you use MetalORM as a query builder only, you manage transactions with your driver or executor.

Example using a `DbExecutor` directly:

```ts
import { MySqlDialect, insertInto, createMysqlExecutor } from 'metal-orm';
import mysql from 'mysql2/promise';
import { Users } from './schema';

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
const executor = createMysqlExecutor(conn);
const dialect = new MySqlDialect();

await executor.beginTransaction?.();
try {
  const insertUser = insertInto(Users)
    .values({ id: 1, name: 'Ada Lovelace', email: 'ada@example.com' })
    .compile(dialect);

  await executor.executeSql(insertUser.sql, insertUser.params);

  await executor.commitTransaction?.();
} catch (err) {
  await executor.rollbackTransaction?.();
  throw err;
}
```

Notes:

- Use the same executor/connection for all statements inside the transaction.
- If you’re not using a `DbExecutor`, compile builders with `.compile(dialect)` and run `BEGIN` / `COMMIT` / `ROLLBACK` using your driver’s API.

## Level 2/3 (ORM runtime): transactional commits

In runtime mode, **`OrmSession.commit()` wraps the flush in a transaction** when the executor supports it:

1. `beforeFlush` interceptors run.
2. The Unit of Work flushes inserts/updates/deletes.
3. Relation changes are processed.
4. A second flush runs to persist pivot/link changes.
5. `afterFlush` interceptors run.
6. Domain events are dispatched *after* the transaction finishes.

If any step throws, the executor’s `rollbackTransaction` is called and the error is re‑thrown.

### Enabling transactions for a session

Provide transaction methods on your executor. For example with SQLite:

```ts
import sqlite3 from 'sqlite3';
import { SQLiteDialect, Orm, OrmSession, createSqliteExecutor } from 'metal-orm';

const db = new sqlite3.Database('./app.db');
const all = (sql: string, params: unknown[] = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const executor = createSqliteExecutor({
  all,
  beginTransaction: () => all('BEGIN'),
  commitTransaction: () => all('COMMIT'),
  rollbackTransaction: () => all('ROLLBACK'),
});

const orm = new Orm({
  dialect: new SQLiteDialect(),
  executorFactory: {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
  },
});

const session = new OrmSession({ orm, executor });
```

Once the executor supports transactions, every `session.commit()` is atomic.

## `Orm.transaction(fn)`: a high-level transaction wrapper

`Orm.transaction` is a convenience wrapper that:

- Creates a session using `executorFactory.createTransactionalExecutor()`.
- Begins a transaction before your function runs.
- Commits on success (including flushing changes).
- Rolls back on errors.
- Disposes the session/executor in `finally`.

```ts
import { selectFromEntity, eq } from 'metal-orm';

await orm.transaction(async session => {
  const [user] = await selectFromEntity(User)
    .where(eq(usersTable.columns.id, 1))
    .execute(session);

  user.name = 'Updated in one transaction';
  user.posts.add({ title: 'Hello', body: '...' });

  // No need to call session.commit() here.
});
```

Guidelines:

- Don’t call `session.commit()` inside `Orm.transaction` unless you intentionally want multiple independent flushes.
- Prefer returning a **fresh transactional executor** from `createTransactionalExecutor` when using a pool, so the whole transaction uses a single dedicated connection.

## `session.transaction(fn)`: scoped helper on an existing session

If you already have a session and want to run a block atomically with its executor:

```ts
import { selectFromEntity, eq } from 'metal-orm';

await session.transaction(async s => {
  const [user] = await selectFromEntity(User)
    .selectColumns('id', 'name')
    .where(eq(usersTable.columns.id, 1))
    .execute(s);

  if (!user) throw new Error('not found');
  user.name = 'Renamed';
});
// Auto-commits on success, rolls back and resets tracking on error.
```

Notes:
- If `executor.capabilities.transactions` is true, begin/commit/rollback are used. Otherwise the helper runs the callback then calls `commit()`.
- Avoid calling `commit()` inside the callback; the helper flushes for you.

## Pooling + transactions

- For pooled setups, wire pooling into `executorFactory` (see [Connection Pooling](./pooling.md)).
- Use a dedicated pooled connection in `createTransactionalExecutor` so each `Orm.transaction`/`session.transaction` stays on one connection and releases it after commit/rollback.

## Rollback behavior

- `session.commit()` rolls back automatically on errors during the flush pipeline.
- You can call `session.rollback()` yourself to abandon tracked changes and revert the current transaction:

```ts
try {
  // mutate entities...
  await session.commit();
} catch (err) {
  await session.rollback();
  throw err;
}
```

After `rollback()`, the Unit of Work and relation-change tracker are reset, so the session no longer considers the previous mutations pending.

## Common pitfalls

- **No transaction methods on the executor**: commits are not atomic. Make sure your executor implements the optional transaction hooks.
- **Mixing connections**: all statements in a transaction must run through the same executor/connection.
- **Nested transactions**: MetalORM doesn’t implement savepoints. Calling `Orm.transaction` inside another `Orm.transaction` creates a *new* session/executor and commits independently.
