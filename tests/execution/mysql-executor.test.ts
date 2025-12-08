// tests/execution/mysql-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  createMysqlExecutor,
  type MysqlClientLike,
} from '../../src/core/execution/executors/mysql-executor.js';

describe('createMysqlExecutor', () => {
  it('maps row array correctly', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];

    const client: MysqlClientLike = {
      async query(sql, params) {
        calls.push({ sql, params });
        return [[{ id: 1 }, { id: 2 }], {}];
      },
    };

    const executor = createMysqlExecutor(client);

    const [result] = await executor.executeSql('SELECT * FROM t', [1]);

    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM t',
      params: [1],
    });

    expect(result.columns).toEqual(['id']);
    expect(result.values).toEqual([[1], [2]]);
  });

  it('respects optional transaction methods', async () => {
    const events: string[] = [];

    const client: MysqlClientLike = {
      async query() {
        return [[], {}];
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

    const executor = createMysqlExecutor(client);

    await executor.beginTransaction?.();
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(events).toEqual(['begin', 'commit', 'rollback']);
  });
});
