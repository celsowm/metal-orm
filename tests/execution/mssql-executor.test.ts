// tests/execution/mssql-executor.test.ts
import { describe, it, expect } from 'vitest';
import {
  createMssqlExecutor,
  createTediousExecutor,
  createTediousMssqlClient,
  type MssqlClientLike,
  type TediousColumn,
  type TediousConnectionLike,
  type TediousRequest,
} from '../../src/core/execution/executors/mssql-executor.js';

const TYPES = {
  NVarChar: 'NV',
  Int: 'INT',
  Float: 'FLOAT',
  BigInt: 'BIGINT',
  Bit: 'BIT',
  DateTime: 'DATETIME',
  VarBinary: 'VARBINARY',
};

function createFakeTediousConnection(rows: TediousColumn[][]) {
  class FakeRequest implements TediousRequest {
    public readonly params: Array<{
      name: string;
      type: unknown;
      value: unknown;
    }> = [];

    private rowHandler?: (columns: TediousColumn[]) => void;

    constructor(
      public readonly sql: string,
      private readonly callback: (err?: Error | null) => void,
    ) {}

    addParameter(name: string, type: unknown, value: unknown) {
      this.params.push({ name, type, value });
    }

    on(event: 'row', listener: (columns: TediousColumn[]) => void) {
      if (event === 'row') {
        this.rowHandler = listener;
      }
    }

    emitRows(rows: TediousColumn[][]) {
      if (this.rowHandler) {
        rows.forEach(row => this.rowHandler?.(row));
      }
      this.callback();
    }
  }

  const requests: FakeRequest[] = [];

  const connection: TediousConnectionLike = {
    execSql(request) {
      const fakeRequest = request as FakeRequest;
      requests.push(fakeRequest);
      fakeRequest.emitRows(rows);
    },
  };

  return { connection, requests, FakeRequest };
}

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

    const payload = await executor.executeSql('SELECT * FROM t WHERE id = @p1', [42]);
    const [result] = payload.resultSets ?? payload;

    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM t WHERE id = @p1',
      params: [42],
    });

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
    expect(payload.resultSets).toEqual(payload);
  });

  it('uses recordsets when available', async () => {
    const client: MssqlClientLike = {
      async query() {
        return {
          recordsets: [
            [{ id: 1 }],
            [{ total: 3 }],
          ],
        };
      },
    };

    const executor = createMssqlExecutor(client);
    const payload = await executor.executeSql('EXEC dbo.proc');
    const results = payload.resultSets ?? payload;

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      columns: ['id'],
      values: [[1]],
    });
    expect(results[1]).toEqual({
      columns: ['total'],
      values: [[3]],
    });
    expect(payload.resultSets).toEqual(results);
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

describe('createTediousMssqlClient', () => {
  it('maps columns and parameters to the executor shape', async () => {
    const rows: TediousColumn[][] = [
      [
        { metadata: { colName: 'id' }, value: 1 },
        { metadata: { colName: 'name' }, value: 'alice' },
      ],
      [
        { metadata: { colName: 'id' }, value: 2 },
        { metadata: { colName: 'name' }, value: 'bob' },
      ],
    ];

    const { connection, requests, FakeRequest } = createFakeTediousConnection(rows);

    const client = createTediousMssqlClient(connection, {
      Request: FakeRequest,
      TYPES,
    });

    const result = await client.query('SELECT * FROM users', [
      1,
      'bob',
    ]);

    expect(result.recordset).toEqual([
      { id: 1, name: 'alice' },
      { id: 2, name: 'bob' },
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0].params).toEqual([
      { name: 'p1', type: TYPES.Int, value: 1 },
      { name: 'p2', type: TYPES.NVarChar, value: 'bob' },
    ]);
  });

  it('wraps transaction callbacks when provided', async () => {
    const events: string[] = [];

    class DummyRequest implements TediousRequest {
      addParameter(_: string, __: unknown, ___: unknown) {}
      on(_: 'row', __: (columns: TediousColumn[]) => void) {}
    }

    const connection: TediousConnectionLike = {
      execSql() {},
      beginTransaction(cb: (err?: Error | null) => void) {
        events.push('begin');
        cb();
      },
      commitTransaction(cb: (err?: Error | null) => void) {
        events.push('commit');
        cb();
      },
      rollbackTransaction(cb: (err?: Error | null) => void) {
        events.push('rollback');
        cb();
      },
    };

    const client = createTediousMssqlClient(connection, {
      Request: DummyRequest,
      TYPES,
    });

    await client.beginTransaction?.();
    await client.commit?.();
    await client.rollback?.();

    expect(events).toEqual(['begin', 'commit', 'rollback']);
  });
});

describe('createTediousExecutor', () => {
  it('composes createTediousMssqlClient + createMssqlExecutor', async () => {
    const rows: TediousColumn[][] = [
      [
        { metadata: { colName: 'id' }, value: 1 },
        { metadata: { colName: 'name' }, value: 'alice' },
      ],
      [
        { metadata: { colName: 'id' }, value: 2 },
        { metadata: { colName: 'name' }, value: 'bob' },
      ],
    ];

    const { connection, requests, FakeRequest } = createFakeTediousConnection(rows);

    const executor = createTediousExecutor(connection, {
      Request: FakeRequest,
      TYPES,
    });

    const payload = await executor.executeSql('SELECT * FROM users WHERE id = @p1', [1]);
    const [result] = payload.resultSets ?? payload;

    expect(result.columns).toEqual(['id', 'name']);
    expect(result.values).toEqual([
      [1, 'alice'],
      [2, 'bob'],
    ]);
    expect(payload.resultSets).toEqual(payload);

    expect(requests[0].params).toEqual([
      { name: 'p1', type: TYPES.Int, value: 1 },
    ]);
  });
});
