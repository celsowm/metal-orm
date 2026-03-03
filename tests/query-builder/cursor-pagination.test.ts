import { describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { selectFrom } from '../../src/query/index.js';
import {
  encodeCursor,
  decodeCursor,
  buildOrderSignature,
  buildKeysetPredicate
} from '../../src/query-builder/select/cursor-pagination.js';

// ---------------------------------------------------------------------------
// Unit tests for pure helpers
// ---------------------------------------------------------------------------

describe('encodeCursor / decodeCursor', () => {
  it('roundtrips a cursor payload', () => {
    const payload = { v: 2 as const, values: [42, '2025-01-01'], orderSig: 'users.id:ASC,users.createdAt:DESC' };
    const encoded = encodeCursor(payload);
    expect(typeof encoded).toBe('string');
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it('throws on invalid base64', () => {
    expect(() => decodeCursor('not-valid!!!')).toThrow('invalid cursor');
  });

  it('throws on valid base64 but wrong shape', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1 })).toString('base64url');
    expect(() => decodeCursor(bad)).toThrow('invalid cursor');
  });
});

describe('buildOrderSignature', () => {
  it('builds deterministic signature', () => {
    const sig = buildOrderSignature([
      { table: 'users', column: 'createdAt', valueKey: 'createdAt', direction: 'DESC' },
      { table: 'users', column: 'id', valueKey: 'id', direction: 'DESC' }
    ]);
    expect(sig).toBe('users.createdAt:DESC,users.id:DESC');
  });
});

describe('buildKeysetPredicate', () => {
  it('single column ASC after', () => {
    const pred = buildKeysetPredicate(
      [{ table: 'users', column: 'id', valueKey: 'id', direction: 'ASC' }],
      [10],
      'after'
    );
    expect(pred).toEqual({
      type: 'BinaryExpression',
      left: { type: 'Column', table: 'users', name: 'id' },
      operator: '>',
      right: { type: 'Literal', value: 10 }
    });
  });

  it('single column DESC after', () => {
    const pred = buildKeysetPredicate(
      [{ table: 'users', column: 'id', valueKey: 'id', direction: 'DESC' }],
      [10],
      'after'
    );
    expect(pred).toMatchObject({ operator: '<' });
  });

  it('single column ASC before', () => {
    const pred = buildKeysetPredicate(
      [{ table: 'users', column: 'id', valueKey: 'id', direction: 'ASC' }],
      [10],
      'before'
    );
    expect(pred).toMatchObject({ operator: '<' });
  });

  it('two columns DESC after', () => {
    const pred = buildKeysetPredicate(
      [
        { table: 'users', column: 'createdAt', valueKey: 'createdAt', direction: 'DESC' },
        { table: 'users', column: 'id', valueKey: 'id', direction: 'DESC' }
      ],
      ['2025-01-01', 5],
      'after'
    );
    // Should be: (createdAt < ?) OR (createdAt = ? AND id < ?)
    expect(pred.type).toBe('LogicalExpression');
    expect((pred as any).operator).toBe('OR');
    expect((pred as any).operands).toHaveLength(2);
  });

  it('three columns produces 3 OR branches', () => {
    const pred = buildKeysetPredicate(
      [
        { table: 't', column: 'a', valueKey: 'a', direction: 'ASC' },
        { table: 't', column: 'b', valueKey: 'b', direction: 'DESC' },
        { table: 't', column: 'c', valueKey: 'c', direction: 'ASC' }
      ],
      [1, 2, 3],
      'after'
    );
    expect(pred.type).toBe('LogicalExpression');
    expect((pred as any).operands).toHaveLength(3);
  });

  it('throws when cursor values do not match the order spec length', () => {
    expect(() =>
      buildKeysetPredicate(
        [{ table: 'users', column: 'id', valueKey: 'id', direction: 'ASC' }],
        [],
        'after'
      )
    ).toThrow('invalid cursor payload');
  });
});

// ---------------------------------------------------------------------------
// Integration: executeCursor on builder with mock executor
// ---------------------------------------------------------------------------

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  createdAt: col.datetime()
});

type MockRowsInput =
  | Record<string, unknown>[]
  | ((sql: string) => Record<string, unknown>[]);

const createMockSession = (input: MockRowsInput) => {
  const executedSqls: string[] = [];

  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql) {
      executedSqls.push(sql);
      const rows = typeof input === 'function' ? input(sql) : input;
      if (rows.length === 0) return [{ columns: [], values: [] }];
      const columns = Object.keys(rows[0]);
      const values = rows.map(r => columns.map(c => r[c]));
      return [{ columns, values }];
    },
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    dispose: async () => {}
  };

  const factory = {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => {}
  };

  const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: factory });
  const session = new OrmSession({ orm, executor });
  return { session, executedSqls };
};

describe('executeCursor validation', () => {
  it('throws when first and last are both provided', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users).orderBy(users.columns.id);
    await expect(qb.executeCursor(session, { first: 10, last: 5 })).rejects.toThrow('"first" and "last"');
  });

  it('throws when neither first nor last is provided', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users).orderBy(users.columns.id);
    await expect(qb.executeCursor(session, {})).rejects.toThrow('either "first" or "last"');
  });

  it('throws when ORDER BY is missing', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users);
    await expect(qb.executeCursor(session, { first: 10 })).rejects.toThrow('ORDER BY is required');
  });

  it('throws when first is not a valid integer', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users).orderBy(users.columns.id);
    await expect(qb.executeCursor(session, { first: 0 })).rejects.toThrow('>= 1');
  });

  it('throws when last is not a valid integer', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users).orderBy(users.columns.id);
    await expect(qb.executeCursor(session, { last: 0 })).rejects.toThrow('>= 1');
  });

  it('throws when ORDER BY uses NULLS FIRST/LAST', async () => {
    const { session } = createMockSession([]);
    const qb = selectFrom(users).orderBy(users.columns.id, { nulls: 'LAST' });
    await expect(qb.executeCursor(session, { first: 10 })).rejects.toThrow('NULLS FIRST/LAST');
  });
});

describe('executeCursor first page', () => {
  it('returns items and pageInfo for first page', async () => {
    const mockRows = [
      { id: 3, name: 'C', createdAt: '2025-03-01' },
      { id: 2, name: 'B', createdAt: '2025-02-01' },
      { id: 1, name: 'A', createdAt: '2025-01-01' }  // extra row = hasNextPage
    ];
    const { session, executedSqls } = createMockSession(mockRows);

    const result = await selectFrom(users)
      .orderBy(users.columns.id, 'DESC')
      .executeCursor(session, { first: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.pageInfo.startCursor).toBeTruthy();
    expect(result.pageInfo.endCursor).toBeTruthy();
    // SQL should contain LIMIT 3 (first+1)
    expect(executedSqls[0]).toContain('LIMIT 3');
  });

  it('hasNextPage false when fewer rows returned', async () => {
    const mockRows = [
      { id: 1, name: 'A', createdAt: '2025-01-01' }
    ];
    const { session } = createMockSession(mockRows);

    const result = await selectFrom(users)
      .orderBy(users.columns.id)
      .executeCursor(session, { first: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.pageInfo.hasNextPage).toBe(false);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
  });

  it('empty result returns null cursors', async () => {
    const { session } = createMockSession([]);

    const result = await selectFrom(users)
      .orderBy(users.columns.id)
      .executeCursor(session, { first: 10 });

    expect(result.items).toHaveLength(0);
    expect(result.pageInfo.startCursor).toBeNull();
    expect(result.pageInfo.endCursor).toBeNull();
    expect(result.pageInfo.hasNextPage).toBe(false);
  });
});

describe('executeCursor with after cursor', () => {
  it('hasPreviousPage is true when after cursor is provided', async () => {
    const mockRows = [{ id: 5, name: 'E', createdAt: '2025-05-01' }];
    const { session } = createMockSession(mockRows);

    const cursor = encodeCursor({
      v: 2,
      values: [10],
      orderSig: 'users.id:DESC'
    });

    const result = await selectFrom(users)
      .orderBy(users.columns.id, 'DESC')
      .executeCursor(session, { first: 10, after: cursor });

    expect(result.pageInfo.hasPreviousPage).toBe(true);
  });

  it('throws on orderSig mismatch', async () => {
    const { session } = createMockSession([]);

    const cursor = encodeCursor({
      v: 2,
      values: [10],
      orderSig: 'users.id:ASC' // mismatch: query uses DESC
    });

    const qb = selectFrom(users).orderBy(users.columns.id, 'DESC');
    await expect(qb.executeCursor(session, { first: 10, after: cursor }))
      .rejects.toThrow('ORDER BY signature does not match');
  });

  it('throws when cursor payload length does not match the ORDER BY clause', async () => {
    const { session } = createMockSession([]);

    const cursor = encodeCursor({
      v: 2,
      values: [],
      orderSig: 'users.id:DESC'
    });

    const qb = selectFrom(users).orderBy(users.columns.id, 'DESC');
    await expect(qb.executeCursor(session, { first: 10, after: cursor }))
      .rejects.toThrow('invalid cursor payload');
  });
});

describe('executeCursor backward pagination', () => {
  it('accepts last/before and keeps the original query order in the returned items', async () => {
    const cursor = encodeCursor({
      v: 2,
      values: [4],
      orderSig: 'users.id:ASC'
    });

    const { session, executedSqls } = createMockSession(sql =>
      sql.includes('ORDER BY "users"."id" DESC')
        ? [
          { id: 3, name: 'C', createdAt: '2025-03-01' },
          { id: 2, name: 'B', createdAt: '2025-02-01' },
          { id: 1, name: 'A', createdAt: '2025-01-01' }
        ]
        : []
    );

    const result = await selectFrom(users)
      .orderBy(users.columns.id, 'ASC')
      .executeCursor(session, { last: 2, before: cursor });

    expect(result.items.map((row: any) => row.id)).toEqual([2, 3]);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(executedSqls[0]).toContain('ORDER BY "users"."id" DESC');
    expect(executedSqls[0]).toContain('LIMIT 3');
  });

  it('throws when building a cursor from null ordered values', async () => {
    const { session } = createMockSession([
      { id: null, name: 'A', createdAt: '2025-01-01' }
    ]);

    await expect(
      selectFrom(users)
        .orderBy(users.columns.id, 'ASC')
        .executeCursor(session, { first: 1 })
    ).rejects.toThrow('requires non-null ORDER BY values');
  });
});
