// tests/execution/mssql-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  createMssqlExecutor,
  type MssqlClientLike,
} from '../../src/core/execution/executors/mssql-executor.js';

describe('createMssqlExecutor', () => {
  it('maps recordset correctly', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];

    const client: MssqlClientLike = {
      async query(sql, params) {
        calls.push({ sql, params });
        return {
          recordset: [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
          ],
        };
      },
    };

    const executor = createMssqlExecutor(client);

    const [result] = await executor.executeSql('SELECT * FROM t WHERE id = @p1', [42]);

    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM t WHERE id = @p1',
      params: [42],
    });

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('respects optional transaction methods', async () => {
    const events: string[] = [];

    const client: MssqlClientLike = {
      async query() {
        return { recordset: [] };
      },
      async beginTransaction() {
        events.push('begin');
      },
      async commit() {
        events.push('commit');
      },
      async rollback() {
        events.push('rollback');
      },
    };

    const executor = createMssqlExecutor(client);

    await executor.beginTransaction?.();
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(events).toEqual(['begin', 'commit', 'rollback']);
  });
});
