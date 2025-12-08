// tests/execution/postgres-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  createPostgresExecutor,
  type PostgresClientLike,
} from '../../src/core/execution/executors/postgres-executor.js';

describe('createPostgresExecutor', () => {
  it('passes SQL and params and returns proper QueryResult', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];

    const client: PostgresClientLike = {
      async query(sql, params) {
        calls.push({ sql, params });
        return {
          rows: [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
          ],
        };
      },
    };

    const executor = createPostgresExecutor(client);

    const [result] = await executor.executeSql(
      'SELECT * FROM users WHERE id = $1',
      [123]
    );

    expect(calls).toEqual([
      {
        sql: 'SELECT * FROM users WHERE id = $1',
        params: [123],
      },
    ]);

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('issues transaction statements on the same client', async () => {
    const executedSql: string[] = [];

    const client: PostgresClientLike = {
      async query(sql, params) {
        if (!params) {
          executedSql.push(sql);
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    const executor = createPostgresExecutor(client);

    await executor.beginTransaction?.();
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(executedSql).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
  });
});
