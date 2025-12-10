import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { TableDef } from '../../../src/schema/table.js';
import { eq } from '../../../src/core/ast/expression.js';

const table = (name: string): TableDef => ({ name, columns: {}, relations: {} });
const col = (name: string, tbl?: string) => ({ type: 'Column', name, table: tbl || 'unknown' } as any);
const lit = (value: any) => ({ type: 'Literal', value } as any);

describe('Set operations', () => {
  const sqlite = new SqliteDialect();
  const postgres = new PostgresDialect();
  const mssql = new SqlServerDialect();

  it('emits UNION with proper parameter ordering', () => {
    const users = table('users');
    const base = new SelectQueryBuilder(users).selectRaw('id').where(eq(col('id', 'users'), lit(1)));
    const other = new SelectQueryBuilder(users).selectRaw('id').where(eq(col('id', 'users'), lit(2)));

    const query = base.union(other).orderBy(col('id', 'users'));
    expect(query.toSql(sqlite)).toBe(
      '(SELECT "users"."id" FROM "users" WHERE "users"."id" = ?) UNION (SELECT "users"."id" FROM "users" WHERE "users"."id" = ?) ORDER BY "users"."id" ASC;'
    );
    expect(query.compile(sqlite).params).toEqual([1, 2]);
  });

  it('supports UNION ALL with ORDER BY + pagination in SQL Server', () => {
    const users = table('users');
    const query = new SelectQueryBuilder(users)
      .selectRaw('id')
      .unionAll(new SelectQueryBuilder(users).selectRaw('id'))
      .orderBy(col('id', 'users'))
      .offset(2)
      .limit(5);

    expect(query.toSql(mssql)).toBe(
      '(SELECT [users].[id] FROM [users]) UNION ALL (SELECT [users].[id] FROM [users]) ORDER BY [users].[id] ASC OFFSET 2 ROWS FETCH NEXT 5 ROWS ONLY;'
    );
  });

  it('emits INTERSECT and EXCEPT operators', () => {
    const users = table('users');
    const intersectQuery = new SelectQueryBuilder(users)
      .selectRaw('id')
      .intersect(new SelectQueryBuilder(users).selectRaw('id'));

    const exceptQuery = new SelectQueryBuilder(users)
      .selectRaw('id')
      .except(new SelectQueryBuilder(users).selectRaw('id'));

    expect(intersectQuery.toSql(postgres)).toBe(
      '(SELECT "users"."id" FROM "users") INTERSECT (SELECT "users"."id" FROM "users");'
    );
    expect(exceptQuery.toSql(postgres)).toBe(
      '(SELECT "users"."id" FROM "users") EXCEPT (SELECT "users"."id" FROM "users");'
    );
  });

  it('rejects ORDER/LIMIT/OFFSET on operands (only outermost allowed)', () => {
    const users = table('users');
    const withOrder = new SelectQueryBuilder(users).selectRaw('id').orderBy(col('id', 'users'));
    const base = new SelectQueryBuilder(users).selectRaw('id');

    expect(() => base.union(withOrder).toSql(sqlite)).toThrowError(/outermost compound query/);
  });

  it('hoists CTEs from operands so WITH appears once', () => {
    const users = table('users');
    const cteOperand = new SelectQueryBuilder(users)
      .with('u', new SelectQueryBuilder(users).selectRaw('id'))
      .selectRaw('id');

    const query = new SelectQueryBuilder(users).selectRaw('id').union(cteOperand);

    expect(query.toSql(sqlite)).toBe(
      'WITH "u" AS (SELECT "users"."id" FROM "users") (SELECT "users"."id" FROM "users") UNION (SELECT "users"."id" FROM "users");'
    );
  });

  it('wraps set-operation subqueries inside EXISTS', () => {
    const users = table('users');
    const sub = new SelectQueryBuilder(users)
      .selectRaw('id')
      .unionAll(new SelectQueryBuilder(users).selectRaw('id'));

    const query = new SelectQueryBuilder(users)
      .selectRaw('id')
      .whereExists(sub);

    expect(query.toSql(sqlite)).toBe(
      'SELECT "users"."id" FROM "users" WHERE EXISTS (SELECT 1 FROM ((SELECT "users"."id" FROM "users") UNION ALL (SELECT "users"."id" FROM "users")) AS _exists);'
    );
  });
});
