import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { TableDef } from '../../src/schema/table.js';
import { ColumnDef, ColumnType } from '../../src/schema/column-types.js';
import { eq, rowNumber, rank, windowFunction, cast } from '../../src/core/ast/expression.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';

const users: TableDef = {
  name: 'users',
  columns: {
    id: { name: 'id', type: 'integer' as ColumnType, table: 'users' } as ColumnDef,
    name: { name: 'name', type: 'string' as ColumnType, table: 'users' } as ColumnDef,
    deptId: { name: 'deptId', type: 'integer' as ColumnType, table: 'users' } as ColumnDef,
  },
  relations: {},
  primaryKey: ['id'],
};

const posts: TableDef = {
  name: 'posts',
  columns: {
    id: { name: 'id', type: 'integer' as ColumnType, table: 'posts' } as ColumnDef,
    title: { name: 'title', type: 'string' as ColumnType, table: 'posts' } as ColumnDef,
    userId: { name: 'userId', type: 'integer' as ColumnType, table: 'posts' } as ColumnDef,
  },
  relations: {},
  primaryKey: ['id'],
};

describe('Advanced SQL Features (Missing) Tests', () => {
  const pg = new PostgresDialect();
  const mysql = new MySqlDialect();
  const sqlite = new SqliteDialect();
  const mssql = new SqlServerDialect();

  describe('Joins', () => {
    it('supports CROSS JOIN', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id')
        .crossJoin(posts);

      const sql = qb.toSql(pg);
      expect(sql).toContain('CROSS JOIN "posts"');
      expect(sql).not.toContain('ON');
    });

    it('supports FULL OUTER JOIN on Postgres', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id')
        .fullOuterJoin(posts, eq(users.columns.id, posts.columns.userId));

      const sql = qb.toSql(pg);
      expect(sql).toContain('FULL JOIN "posts" ON "users"."id" = "posts"."userId"');
    });

    it('throws on FULL OUTER JOIN for MySQL', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id')
        .fullOuterJoin(posts, eq(users.columns.id, posts.columns.userId));

      expect(() => qb.toSql(mysql)).toThrow('Join kind FULL is not supported by this dialect.');
    });

    it('supports generic join method', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id')
        .join(posts, eq(users.columns.id, posts.columns.userId), 'LEFT');

      const sql = qb.toSql(pg);
      expect(sql).toContain('LEFT JOIN "posts" ON "users"."id" = "posts"."userId"');
    });
  });

  describe('Window Functions Fluent API', () => {
    it('applies builder-level partitionBy and orderBy to window functions', () => {
      const qb = new SelectQueryBuilder(users)
        .select({
          id: users.columns.id,
          rowNum: rowNumber(),
          r: rank()
        })
        .partitionBy(users.columns.deptId)
        .orderBy(users.columns.id, 'DESC');

      const sql = qb.toSql(pg);

      // Check window functions in selection
      expect(sql).toContain('ROW_NUMBER() OVER (PARTITION BY "users"."deptId" ORDER BY "users"."id" DESC)');
      expect(sql).toContain('RANK() OVER (PARTITION BY "users"."deptId" ORDER BY "users"."id" DESC)');

      // Check query-level ORDER BY
      expect(sql).toContain('ORDER BY "users"."id" DESC');
    });

    it('does not override existing window function configuration', () => {
      const qb = new SelectQueryBuilder(users)
        .select({
          id: users.columns.id,
          // rowNum has its own ordering via windowFunction helper
          rowNum: windowFunction<number>('ROW_NUMBER', [], [], [{ column: users.columns.name, direction: 'ASC' }])
        })
        .partitionBy(users.columns.deptId)
        .orderBy(users.columns.id, 'DESC');

      const sql = qb.toSql(pg);

      // ROW_NUMBER should keep its own ORDER BY but get builder's PARTITION BY
      expect(sql).toContain('ROW_NUMBER() OVER (PARTITION BY "users"."deptId" ORDER BY "users"."name" ASC)');
    });

    it('works with nested window functions (e.g. inside CAST)', () => {
      const qb = new SelectQueryBuilder(users)
        .select({
          id: users.columns.id,
          rowNumStr: cast(rowNumber(), 'varchar')
        })
        .partitionBy(users.columns.deptId)
        .orderBy(users.columns.id, 'ASC');

      const sql = qb.toSql(pg);

      expect(sql).toContain('CAST(ROW_NUMBER() OVER (PARTITION BY "users"."deptId" ORDER BY "users"."id" ASC) AS varchar)');
    });

    it('throws when window functions are used on dialects that do not support them', () => {
        // We'll need a dialect that returns false for supportsWindowFunctions
        class LegacyDialect extends PostgresDialect {
            supportsWindowFunctions() { return false; }
        }

        const qb = new SelectQueryBuilder(users)
            .select({ rn: rowNumber() });

        expect(() => qb.toSql(new LegacyDialect())).toThrow('Window functions are not supported by this dialect.');
    });
  });
});
