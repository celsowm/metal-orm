import { describe, expect, it } from 'vitest';
import type { InsertQueryNode, SelectQueryNode } from '../../src/core/ast/query.js';
import { DialectFactory } from '../../src/core/dialect/dialect-factory.js';
import { isProcedureCompiler } from '../../src/core/dialect/capabilities/procedure-compiler.js';
import { createMySqlDialect, MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { createPostgresDialect, PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { createSqliteDialect, SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { createSqlServerDialect, SqlServerDialect } from '../../src/core/dialect/mssql/index.js';

const table = { type: 'Table', name: 'users' } as const;
const id = { type: 'Column', table: 'users', name: 'id' } as const;
const name = { type: 'Column', table: 'users', name: 'name' } as const;

const select: SelectQueryNode = {
  type: 'SelectQuery',
  from: table,
  columns: [id, name],
  joins: []
};

const insert: InsertQueryNode = {
  type: 'InsertQuery',
  into: table,
  columns: [name],
  source: {
    type: 'InsertValues',
    rows: [[{ type: 'Literal', value: 'Ada' }]]
  }
};

describe('pure dialect composition', () => {
  it('keeps constructor facades behavior-identical to pure factories', () => {
    const cases = [
      [createMySqlDialect(), new MySqlDialect()],
      [createPostgresDialect(), new PostgresDialect()],
      [createSqliteDialect(), new SqliteDialect()],
      [createSqlServerDialect(), new SqlServerDialect()]
    ] as const;

    for (const [composed, facade] of cases) {
      expect(facade.compileSelect(select)).toEqual(composed.compileSelect(select));
      expect(facade.compileInsert(insert)).toEqual(composed.compileInsert(insert));
    }
  });

  it('preserves backend parameter placeholder syntax', () => {
    expect(createMySqlDialect().compileInsert(insert).sql).toContain('VALUES (?)');
    expect(createSqliteDialect().compileInsert(insert).sql).toContain('VALUES (?)');
    expect(createPostgresDialect().compileInsert(insert).sql).toContain('VALUES ($1)');
    expect(createSqlServerDialect().compileInsert(insert).sql).toContain('VALUES (@p1)');
  });

  it('makes DialectFactory use pure factories rather than facade classes', () => {
    DialectFactory.clear();

    expect(DialectFactory.create('mysql')).not.toBeInstanceOf(MySqlDialect);
    expect(DialectFactory.create('postgres')).not.toBeInstanceOf(PostgresDialect);
    expect(DialectFactory.create('sqlite')).not.toBeInstanceOf(SqliteDialect);
    expect(DialectFactory.create('mssql')).not.toBeInstanceOf(SqlServerDialect);
  });

  it('attaches procedure capability structurally only where supported', () => {
    expect(isProcedureCompiler(createMySqlDialect())).toBe(true);
    expect(isProcedureCompiler(createPostgresDialect())).toBe(true);
    expect(isProcedureCompiler(createSqlServerDialect())).toBe(true);
    expect(isProcedureCompiler(createSqliteDialect())).toBe(false);
  });
});
