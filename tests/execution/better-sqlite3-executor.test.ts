// tests/execution/better-sqlite3-executor.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createBetterSqlite3Executor,
  type BetterSqlite3ClientLike,
} from '../../src/core/execution/executors/better-sqlite3-executor.js';

describe('createBetterSqlite3Executor', () => {
  it('maps all() results correctly for readers', async () => {
    const mockStmt = {
      reader: true,
      all: vi.fn().mockReturnValue([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]),
      run: vi.fn(),
    };
    const client: BetterSqlite3ClientLike = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      transaction: vi.fn(),
    };

    const executor = createBetterSqlite3Executor(client);

    const [result] = await executor.executeSql('SELECT * FROM t WHERE id = ?', [42]);

    expect(client.prepare).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?');
    expect(mockStmt.all).toHaveBeenCalledWith(42);
    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('maps run() results correctly for writers', async () => {
    const mockStmt = {
      reader: false,
      all: vi.fn(),
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 }),
    };
    const client: BetterSqlite3ClientLike = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      transaction: vi.fn(),
    };

    const executor = createBetterSqlite3Executor(client);

    const [result] = await executor.executeSql('INSERT INTO t (name) VALUES (?)', ['alice']);

    expect(client.prepare).toHaveBeenCalledWith('INSERT INTO t (name) VALUES (?)');
    expect(mockStmt.run).toHaveBeenCalledWith('alice');
    expect(result.meta?.rowsAffected).toBe(1);
    expect(result.meta?.insertId).toBe(123);
  });

  it('handles bigint lastInsertRowid', async () => {
    const mockStmt = {
      reader: false,
      all: vi.fn(),
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: BigInt('900719925474099100') }),
    };
    const client: BetterSqlite3ClientLike = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      transaction: vi.fn(),
    };

    const executor = createBetterSqlite3Executor(client);

    const [result] = await executor.executeSql('INSERT INTO t (name) VALUES (?)', ['alice']);

    expect(result.meta?.insertId).toBe('900719925474099100');
  });

  it('wires transaction and savepoint methods', async () => {
    const mockStmts: Record<string, any> = {};
    const prepare = vi.fn().mockImplementation((sql: string) => {
      if (!mockStmts[sql]) {
        mockStmts[sql] = {
          reader: false,
          run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
        };
      }
      return mockStmts[sql];
    });

    const client: BetterSqlite3ClientLike = {
      prepare,
      transaction: vi.fn(),
    };

    const executor = createBetterSqlite3Executor(client);

    await executor.beginTransaction();
    expect(prepare).toHaveBeenCalledWith('BEGIN');
    expect(mockStmts['BEGIN'].run).toHaveBeenCalled();

    await executor.savepoint!('sp1');
    expect(prepare).toHaveBeenCalledWith('SAVEPOINT sp1');
    expect(mockStmts['SAVEPOINT sp1'].run).toHaveBeenCalled();

    await executor.releaseSavepoint!('sp1');
    expect(prepare).toHaveBeenCalledWith('RELEASE SAVEPOINT sp1');
    expect(mockStmts['RELEASE SAVEPOINT sp1'].run).toHaveBeenCalled();

    await executor.rollbackToSavepoint!('sp1');
    expect(prepare).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp1');
    expect(mockStmts['ROLLBACK TO SAVEPOINT sp1'].run).toHaveBeenCalled();

    await executor.commitTransaction();
    expect(prepare).toHaveBeenCalledWith('COMMIT');
    expect(mockStmts['COMMIT'].run).toHaveBeenCalled();

    await executor.rollbackTransaction();
    expect(prepare).toHaveBeenCalledWith('ROLLBACK');
    expect(mockStmts['ROLLBACK'].run).toHaveBeenCalled();
  });

  it('validates savepoint names', async () => {
    const client: BetterSqlite3ClientLike = {
      prepare: vi.fn(),
      transaction: vi.fn(),
    };

    const executor = createBetterSqlite3Executor(client);
    await expect(executor.savepoint!('bad-name')).rejects.toThrow('Invalid savepoint name');
  });
});
