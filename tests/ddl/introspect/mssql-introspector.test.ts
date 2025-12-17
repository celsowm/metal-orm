import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbExecutor } from '../../../src/core/execution/db-executor.js';
import type { IntrospectOptions } from '../../../src/core/ddl/introspect/types.js';
import { mssqlIntrospector } from '../../../src/core/ddl/introspect/mssql.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';

const sqlCalls: string[] = [];
let responseQueue: Record<string, unknown>[][] = [];

vi.mock('../../../src/core/ddl/introspect/utils.js', async () => {
  const actual = await vi.importActual('../../../src/core/ddl/introspect/utils.js');
  return {
    ...actual,
    queryRows: async function (_executor, sql) {
      sqlCalls.push(sql ?? '');
      return responseQueue.shift() ?? [];
    },
  };
});

beforeEach(() => {
  sqlCalls.length = 0;
  responseQueue = [];
});

describe('mssqlIntrospector', () => {
  it('exposes varchar and decimal metadata in the column type string', async () => {
    const columnRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'id',
        data_type: 'int',
        is_nullable: 0,
        is_identity: 1,
        column_default: null,
      },
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'numero',
        data_type: 'varchar(20)',
        is_nullable: 0,
        is_identity: 0,
        column_default: null,
      },
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'valor_causa',
        data_type: 'decimal(18,2)',
        is_nullable: 1,
        is_identity: 0,
        column_default: null,
      },
    ];

    const pkRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'id',
        key_ordinal: 1,
      },
    ];

    responseQueue = [columnRows, pkRows, [], []];

    const schema = await mssqlIntrospector.introspect(
      {
        executor: {} as DbExecutor,
        dialect: new SqlServerDialect()
      },
      { schema: 'dbo' } satisfies IntrospectOptions
    );

    expect(sqlCalls).toHaveLength(4);
    expect(sqlCalls[0]).toContain('c.max_length');
    expect(sqlCalls[0]).toContain('c.precision');
    expect(sqlCalls[0]).toContain('c.scale');

    const table = schema.tables.find(t => t.name === 'processo_judicial');
    expect(table).toBeDefined();

    const numeroColumn = table!.columns.find(c => c.name === 'numero');
    expect(numeroColumn).toMatchObject({ type: 'varchar(20)' });

    const valorColumn = table!.columns.find(c => c.name === 'valor_causa');
    expect(valorColumn?.type).toBe('decimal(18,2)');
  });
});
