// tests/execution/db-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  rowsToQueryResult,
  createExecutorFromQueryRunner,
  type DbExecutor,
} from '../../src/core/execution/db-executor.js';

describe('rowsToQueryResult', () => {
  it('produces empty result for no rows', () => {
    const res = rowsToQueryResult([]);
    expect(res.columns).toEqual([]);
    expect(res.values).toEqual([]);
  });

  it('uses keys of the first row as columns', () => {
    const res = rowsToQueryResult([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    expect(res.columns).toEqual(['id', 'name']);
    expect(res.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });
});

describe('createExecutorFromQueryRunner', () => {
  it('delegates SQL + params and maps rows correctly', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];

    const executor: DbExecutor = createExecutorFromQueryRunner({
      async query(sql, params) {
        calls.push({ sql, params });
        return [{ id: 1 }, { id: 2 }];
      },
    });

    const [result] = await executor.executeSql('SELECT * FROM t WHERE id = ?', [42]);

    expect(calls).toEqual([
      { sql: 'SELECT * FROM t WHERE id = ?', params: [42] },
    ]);

    expect(result.columns).toEqual(['id']);
    expect(result.values).toEqual([[1], [2]]);
  });

  it('rewires transaction methods when present', async () => {
    const events: string[] = [];

    const executor = createExecutorFromQueryRunner({
      async query() {
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
    });

    await executor.beginTransaction?.();
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(events).toEqual(['begin', 'commit', 'rollback']);
  });
});
