import { describe, expect, it } from 'vitest';
import { InsertQueryBuilder, col, defineTable, eq } from '../../src/index.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(255)),
  name: col.varchar(255)
});

describe('Insert upsert compilation', () => {
  it('compiles PostgreSQL ON CONFLICT DO UPDATE', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doUpdate({ name: 'Alice Updated' })
      .compile('postgres');

    expect(compiled.sql).toBe(
      'INSERT INTO "users" ("id", "email", "name") VALUES ($1, $2, $3) ON CONFLICT ("id") DO UPDATE SET "name" = $4;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice', 'Alice Updated']);
  });

  it('compiles PostgreSQL ON CONFLICT DO UPDATE with WHERE', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doUpdate({ name: 'Alice Updated' }, eq(users.columns.email, 'alice@example.com'))
      .compile('postgres');

    expect(compiled.sql).toBe(
      'INSERT INTO "users" ("id", "email", "name") VALUES ($1, $2, $3) ON CONFLICT ("id") DO UPDATE SET "name" = $4 WHERE "users"."email" = $5;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice', 'Alice Updated', 'alice@example.com']);
  });

  it('compiles PostgreSQL ON CONFLICT ON CONSTRAINT ... DO NOTHING', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([], 'users_email_key')
      .doNothing()
      .compile('postgres');

    expect(compiled.sql).toBe(
      'INSERT INTO "users" ("id", "email", "name") VALUES ($1, $2, $3) ON CONFLICT ON CONSTRAINT "users_email_key" DO NOTHING;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice']);
  });

  it('compiles SQLite ON CONFLICT DO NOTHING', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doNothing()
      .compile('sqlite');

    expect(compiled.sql).toBe(
      'INSERT INTO "users" ("id", "email", "name") VALUES (?, ?, ?) ON CONFLICT ("id") DO NOTHING;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice']);
  });

  it('compiles SQLite ON CONFLICT DO UPDATE with WHERE', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doUpdate({ name: 'Alice Updated' }, eq(users.columns.email, 'alice@example.com'))
      .compile('sqlite');

    expect(compiled.sql).toBe(
      'INSERT INTO "users" ("id", "email", "name") VALUES (?, ?, ?) ON CONFLICT ("id") DO UPDATE SET "name" = ? WHERE "users"."email" = ?;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice', 'Alice Updated', 'alice@example.com']);
  });

  it('compiles MySQL ON DUPLICATE KEY UPDATE for DO UPDATE', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doUpdate({ name: 'Alice Updated' })
      .compile('mysql');

    expect(compiled.sql).toBe(
      'INSERT INTO `users` (`id`, `email`, `name`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name` = ?;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice', 'Alice Updated']);
  });

  it('compiles MySQL ON DUPLICATE KEY UPDATE no-op for DO NOTHING', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([])
      .doNothing()
      .compile('mysql');

    expect(compiled.sql).toBe(
      'INSERT INTO `users` (`id`, `email`, `name`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `id` = `id`;'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice']);
  });

  it('compiles MSSQL MERGE for DO UPDATE', () => {
    const compiled = new InsertQueryBuilder(users)
      .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
      .onConflict([users.columns.id])
      .doUpdate({ name: 'Alice Updated' })
      .compile('mssql');

    expect(compiled.sql).toBe(
      'MERGE INTO [users] USING (VALUES (@p1, @p2, @p3)) AS [src] ([id], [email], [name]) ON [users].[id] = [src].[id] WHEN MATCHED THEN UPDATE SET [users].[name] = @p4 WHEN NOT MATCHED THEN INSERT ([id], [email], [name]) VALUES ([src].[id], [src].[email], [src].[name]);'
    );
    expect(compiled.params).toEqual([1, 'alice@example.com', 'Alice', 'Alice Updated']);
  });

  it('validates missing conflict columns for PostgreSQL/SQLite/MSSQL', () => {
    const build = (dialect: 'postgres' | 'sqlite' | 'mssql') =>
      () => new InsertQueryBuilder(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .onConflict([])
        .doNothing()
        .compile(dialect);

    expect(build('postgres')).toThrow('PostgreSQL ON CONFLICT requires conflict columns or a constraint name.');
    expect(build('sqlite')).toThrow('SQLite ON CONFLICT requires conflict columns.');
    expect(build('mssql')).toThrow('MSSQL MERGE requires conflict columns for the ON clause.');
  });

  it('rejects named constraints in SQLite', () => {
    const run = () =>
      new InsertQueryBuilder(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .onConflict([], 'users_email_key')
        .doNothing()
        .compile('sqlite');

    expect(run).toThrow('SQLite ON CONFLICT does not support named constraints.');
  });
});
