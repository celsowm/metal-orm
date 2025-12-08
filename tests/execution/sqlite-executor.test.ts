// tests/execution/sqlite-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  createSqliteExecutor,
  type SqliteClientLike,
} from '../../src/core/execution/executors/sqlite-executor.js';

describe('createSqliteExecutor', () => {
  it('maps all() results correctly', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];

    const client: SqliteClientLike = {
      async all(sql, params) {
        calls.push({ sql, params });
        return [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
      },
    };

    const executor = createSqliteExecutor(client);

    const [result] = await executor.executeSql('SELECT * FROM t WHERE id = ?', [42]);

    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM t WHERE id = ?',
      params: [42],
    });

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('wires transaction methods when present', async () => {
    const events: string[] = [];

    const client: SqliteClientLike = {
      async all() {
        return [];
      },
      async beginTransaction() {
        events.push('begin');
      },
      async commitTransaction() {
        events.push('commit');
      },
      async rollbackTransaction() {
        events.push('rollback');
      },
    };

    const executor = createSqliteExecutor(client);

    await executor.beginTransaction?.();
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(events).toEqual(['begin', 'commit', 'rollback']);
  });
});
