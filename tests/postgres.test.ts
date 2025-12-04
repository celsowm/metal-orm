import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select';
import { PostgresDialect } from '../src/core/dialect/postgres';
import { Users } from '../src/playground/features/playground/data/schema';
import { jsonPath, eq } from '../src/core/ast/expression';

describe('PostgresDialect', () => {
  it('should compile a simple select', () => {
    const query = new SelectQueryBuilder(Users).selectRaw('*');
    const dialect = new PostgresDialect();
    const compiled = query.compile(dialect);
    expect(compiled.sql).toBe('SELECT "users"."*" FROM "users";');
  });

  it('should compile a select with a where clause', () => {
    const query = new SelectQueryBuilder(Users).selectRaw('*').where(eq(Users.columns.id, 1));
    const dialect = new PostgresDialect();
    const compiled = query.compile(dialect);
    expect(compiled.sql).toBe('SELECT "users"."*" FROM "users" WHERE "users"."id" = ?;');
    expect(compiled.params).toEqual([1]);
  });

  it('should compile a select with a json path', () => {
    const query = new SelectQueryBuilder(Users).selectRaw('*').where(eq(jsonPath(Users.columns.settings, '$.first'), 'John'));
    const dialect = new PostgresDialect();
    const compiled = query.compile(dialect);
    expect(compiled.sql).toBe('SELECT "users"."*" FROM "users" WHERE "users"."settings"->>\'$.first\' = ?;');
    expect(compiled.params).toEqual(['John']);
  });
});
