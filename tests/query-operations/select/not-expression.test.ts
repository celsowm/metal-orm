import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import {
  and,
  between,
  eq,
  exists,
  inList,
  not,
  notBetween,
  notExists,
  notInList,
  notLike,
  or
} from '../../../src/core/ast/expression.js';
import { Orders, Users } from '../../fixtures/schema.js';

describe('not() unary expression', () => {
  const sqlite = new SqliteDialect();
  const postgres = new PostgresDialect();
  const mysql = new MySqlDialect();
  const mssql = new SqlServerDialect();

  describe('AST Generation', () => {
    it('creates NotExpressionNode for not(eq(...))', () => {
      const node = not(eq(Users.columns.id, 1));
      expect(node.type).toBe('NotExpression');
      expect(node.operand.type).toBe('BinaryExpression');
    });
  });

  describe('SQL Compilation', () => {
    it('compiles NOT (a = 1 OR b = 2) across all dialects', () => {
      const predicate = not(or(eq(Users.columns.id, 1), eq(Users.columns.role, 'admin')));
      const query = new SelectQueryBuilder(Users).selectRaw('*').where(predicate);

      expect(query.compile(sqlite).sql).toContain('NOT ("users"."id" = ? OR "users"."role" = ?)');
      expect(query.compile(postgres).sql).toContain('NOT ("users"."id" = $1 OR "users"."role" = $2)');
      expect(query.compile(mysql).sql).toContain('NOT (`users`.`id` = ? OR `users`.`role` = ?)');
      expect(query.compile(mssql).sql).toMatch(/NOT \(\[users\]\.\[id\] = (@p1|\?) OR \[users\]\.\[role\] = (@p2|\?)\)/);
    });

    it('compiles nested not(not(expr))', () => {
      const predicate = not(not(eq(Users.columns.id, 42)));
      const query = new SelectQueryBuilder(Users).selectRaw('*').where(predicate);

      expect(query.compile(sqlite).sql).toContain('NOT (NOT ("users"."id" = ?))');
    });
  });

  describe('Compatibility with existing negative helpers', () => {
    it('keeps notLike/notBetween/notInList/notExists behavior unchanged', () => {
      const subquery = new SelectQueryBuilder(Orders)
        .select({ id: Orders.columns.id })
        .where(eq(Orders.columns.user_id, Users.columns.id))
        .getAST();

      const query = new SelectQueryBuilder(Users)
        .selectRaw('*')
        .where(and(
          notLike(Users.columns.name, 'adm%'),
          notBetween(Users.columns.id, 10, 20),
          notInList(Users.columns.id, [1, 2, 3]),
          notExists(subquery),
          not(between(Users.columns.id, 100, 200)),
          not(exists(subquery)),
          not(inList(Users.columns.id, [7, 8]))
        ));

      const { sql } = query.compile(sqlite);
      expect(sql).toContain('"users"."name" NOT LIKE ?');
      expect(sql).toContain('"users"."id" NOT BETWEEN ? AND ?');
      expect(sql).toContain('"users"."id" NOT IN (?, ?, ?)');
      expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "orders"');
      expect(sql).toContain('NOT ("users"."id" BETWEEN ? AND ?)');
      expect(sql).toContain('NOT (EXISTS (SELECT 1 FROM "orders"');
      expect(sql).toContain('NOT ("users"."id" IN (?, ?))');
    });
  });
});
