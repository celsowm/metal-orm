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

    const payload = await executor.executeSql('SELECT * FROM t', [1]);
    const [result] = payload.resultSets ?? payload;

    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM t',
      params: [1],
    });

    expect(result.columns).toEqual(['id']);
    expect(result.values).toEqual([[1], [2]]);
    expect(payload.resultSets).toEqual(payload);
  });

  it('captures multiple result sets from a single execution', async () => {
    const client: MysqlClientLike = {
      async query() {
        return [
          [
            [{ id: 1, label: 'first' }],
            [{ outValue: 99 }],
            { affectedRows: 2, insertId: 0 }
          ],
          {}
        ];
      },
    };

    const executor = createMysqlExecutor(client);
    const payload = await executor.executeSql('CALL multi_result_proc()');
    const results = payload.resultSets ?? payload;

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      columns: ['id', 'label'],
      values: [[1, 'first']],
    });
    expect(results[1]).toEqual({
      columns: ['outValue'],
      values: [[99]],
    });
    expect(results[2]).toEqual({
      columns: [],
      values: [],
      meta: { rowsAffected: 2, insertId: 0 },
    });
    expect(payload.resultSets).toEqual(results);
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
