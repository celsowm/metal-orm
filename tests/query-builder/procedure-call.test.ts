import { describe, expect, it } from 'vitest';
import { callProcedure } from '../../src/query-builder/procedure-call.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';

describe('ProcedureCallBuilder', () => {
  it('keeps immutable builder behavior', () => {
    const base = callProcedure('rebuild_cache');
    const withIn = base.in('tenantId', 10);
    const withOut = withIn.out('total');

    expect(base.getAST().params).toEqual([]);
    expect(withIn.getAST().params).toHaveLength(1);
    expect(withOut.getAST().params).toHaveLength(2);
  });

  it('compiles postgres procedure calls with out metadata from first result set', () => {
    const compiled = callProcedure('rebuild_cache', { schema: 'public' })
      .in('tenantId', 10)
      .out('totalRows')
      .inOut('cursor', 1)
      .compile(new PostgresDialect());

    expect(compiled.sql).toBe('CALL "public"."rebuild_cache"($1, $2);');
    expect(compiled.params).toEqual([10, 1]);
    expect(compiled.outParams).toEqual({
      source: 'firstResultSet',
      names: ['totalRows', 'cursor']
    });
  });

  it('compiles mysql procedure calls with out metadata from last result set', () => {
    const compiled = callProcedure('rebuild_cache')
      .in('tenantId', 10)
      .out('totalRows')
      .inOut('cursor', 1)
      .compile(new MySqlDialect());

    expect(compiled.sql).toContain('CALL `rebuild_cache`(');
    expect(compiled.sql).toContain('SET @__metal_cursor_3 = ?;');
    expect(compiled.sql).toContain('SELECT @__metal_totalRows_2 AS `totalRows`');
    expect(compiled.outParams).toEqual({
      source: 'lastResultSet',
      names: ['totalRows', 'cursor']
    });
    expect(compiled.params).toEqual([10, 1]);
  });

  it('requires dbType for mssql out/inout parameters', () => {
    expect(() =>
      callProcedure('sync_totals')
        .out('totalRows')
        .compile(new SqlServerDialect())
    ).toThrow('requires "dbType"');

    const compiled = callProcedure('sync_totals')
      .in('tenantId', 10)
      .out('totalRows', { dbType: 'INT' })
      .inOut('cursor', 1, { dbType: 'INT' })
      .compile(new SqlServerDialect());

    expect(compiled.sql).toContain('DECLARE @__metal_totalRows_2 INT;');
    expect(compiled.sql).toContain('EXEC [sync_totals]');
    expect(compiled.sql).toContain('SELECT @__metal_totalRows_2 AS [totalRows]');
    expect(compiled.outParams).toEqual({
      source: 'lastResultSet',
      names: ['totalRows', 'cursor']
    });
  });

  it('throws explicit unsupported error for sqlite', () => {
    expect(() => callProcedure('any_proc').compile(new SqliteDialect()))
      .toThrow('Stored procedures are not supported by the SQLite dialect.');
  });
});
