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

    const payload = await executor.executeSql('SELECT * FROM t WHERE id = ?', [42]);
    const [result] = payload.resultSets ?? payload;

    expect(calls).toEqual([
      { sql: 'SELECT * FROM t WHERE id = ?', params: [42] },
    ]);

    expect(result.columns).toEqual(['id']);
    expect(result.values).toEqual([[1], [2]]);
    expect(payload.resultSets).toEqual(payload);
  });

  it('rewires transaction and savepoint methods when present', async () => {
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
      async savepoint(name: string) {
        events.push(`savepoint:${name}`);
      },
      async releaseSavepoint(name: string) {
        events.push(`release:${name}`);
      },
      async rollbackToSavepoint(name: string) {
        events.push(`rollbackTo:${name}`);
      },
    });

    await executor.beginTransaction?.();
    await executor.savepoint!('sp1');
    await executor.releaseSavepoint!('sp1');
    await executor.rollbackToSavepoint!('sp1');
    await executor.commitTransaction?.();
    await executor.rollbackTransaction?.();

    expect(events).toEqual([
      'begin',
      'savepoint:sp1',
      'release:sp1',
      'rollbackTo:sp1',
      'commit',
      'rollback',
    ]);
    expect(executor.capabilities.savepoints).toBe(true);
  });

  it('throws on savepoint methods when runner does not implement them', async () => {
    const executor = createExecutorFromQueryRunner({
      async query() {
        return [];
      },
      async beginTransaction() {},
      async commitTransaction() {},
      async rollbackTransaction() {},
    });

    expect(executor.capabilities.savepoints).toBeUndefined();
    await expect(executor.savepoint!('sp1')).rejects.toThrow('Savepoints are not supported by this executor');
  });
});
