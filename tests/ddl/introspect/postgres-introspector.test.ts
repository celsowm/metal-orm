import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbExecutor } from '../../../src/core/execution/db-executor.js';
import type { IntrospectOptions } from '../../../src/core/ddl/introspect/types.js';
import { postgresIntrospector } from '../../../src/core/ddl/introspect/postgres.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';

const sqlCalls: string[] = [];
let responseQueue: Record<string, unknown>[][] = [];

vi.mock('../../../src/core/ddl/introspect/utils.js', async () => {
  const actual = await vi.importActual('../../../src/core/ddl/introspect/utils.js');
  return {
    ...actual,
    queryRows: async function (_executor, sql) {
      sqlCalls.push(sql ?? '');
      return responseQueue.shift() ?? [];
    }
  };
});

beforeEach(() => {
  sqlCalls.length = 0;
  responseQueue = [];
});

describe('postgresIntrospector', () => {
  it('captures table and column comments', async () => {
    const columnRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'id',
        data_type: 'int4',
        is_nullable: 'NO',
        column_default: null,
        ordinal_position: 1
      }
    ];
    const columnCommentRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'id',
        description: 'Identificador do processo judicial'
      }
    ];
    const tableCommentRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        description: 'Processos pendentes'
      }
    ];
    const pkRows: Record<string, unknown>[] = [
      {
        table_schema: 'dbo',
        table_name: 'processo_judicial',
        column_name: 'id',
        ordinal_position: 1,
        constraint_name: 'PK_processos'
      }
    ];
    const fkRows: Record<string, unknown>[] = [];
    const indexRows: Record<string, unknown>[] = [];

    responseQueue = [columnRows, columnCommentRows, tableCommentRows, pkRows, fkRows, indexRows];

    const schema = await postgresIntrospector.introspect(
      {
        executor: {} as DbExecutor,
        dialect: new PostgresDialect()
      },
      { schema: 'dbo' } satisfies IntrospectOptions
    );

    expect(sqlCalls).toHaveLength(6);
    expect(schema.tables).toHaveLength(1);

    const table = schema.tables[0];
    expect(table.comment).toBe('Processos pendentes');
    const idColumn = table.columns.find(c => c.name === 'id');
    expect(idColumn?.comment).toBe('Identificador do processo judicial');
  });
});
