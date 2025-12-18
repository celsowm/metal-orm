import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbExecutor } from '../../../src/core/execution/db-executor.js';
import type { IntrospectOptions } from '../../../src/core/ddl/introspect/types.js';
import { sqliteIntrospector } from '../../../src/core/ddl/introspect/sqlite.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';

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

describe('sqliteIntrospector', () => {
  it('loads comments from schema_comments metadata table', async () => {
    const schemaCommentsCheck = [{ name: 'schema_comments' }];
    const schemaCommentsRows: Record<string, unknown>[] = [
      {
        object_type: 'table',
        schema_name: null,
        table_name: 'accounts',
        column_name: null,
        comment: 'Contas do sistema'
      },
      {
        object_type: 'column',
        schema_name: null,
        table_name: 'accounts',
        column_name: 'id',
        comment: 'Identificador da conta'
      }
    ];
    const tableRows: Record<string, unknown>[] = [{ name: 'accounts' }];
    const tableInfoRows: Record<string, unknown>[] = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
    ];
    const fkRows: Record<string, unknown>[] = [];
    const indexRows: Record<string, unknown>[] = [];

    responseQueue = [schemaCommentsCheck, schemaCommentsRows, tableRows, tableInfoRows, fkRows, indexRows];

    const schema = await sqliteIntrospector.introspect(
      {
        executor: {} as DbExecutor,
        dialect: new SqliteDialect()
      },
      {} satisfies IntrospectOptions
    );

    expect(sqlCalls).toHaveLength(6);
    expect(schema.tables).toHaveLength(1);

    const table = schema.tables[0];
    expect(table.comment).toBe('Contas do sistema');
    const idColumn = table.columns.find(c => c.name === 'id');
    expect(idColumn?.comment).toBe('Identificador da conta');
  });
});
