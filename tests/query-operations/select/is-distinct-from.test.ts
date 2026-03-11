import { describe, it, expect } from 'vitest';
import {
  isDistinctFrom,
  isNotDistinctFrom
} from '../../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { Users, Orders } from '../../fixtures/schema.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';

describe('isDistinctFrom', () => {
  const sqlite = new SqliteDialect();
  const postgres = new PostgresDialect();
  const mysql = new MySqlDialect();
  const mssql = new SqlServerDialect();

  describe('isDistinctFrom', () => {
    it('should generate correct SQL for PostgreSQL', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(postgres).sql;
      expect(sql).toContain('IS DISTINCT FROM');
      expect(sql).toMatch(/"users"\."name" IS DISTINCT FROM "users"\."name"/);
    });

    it('should generate correct SQL for MySQL using spaceship operator', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(mysql).sql;
      expect(sql).toContain('NOT');
      expect(sql).toContain('<=>');
      expect(sql).toMatch(/NOT \(`users`\.`name` <=> `users`\.`name`\)/);
    });

    it('should generate correct SQL for SQLite', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(sqlite).sql;
      expect(sql).toContain('IS DISTINCT FROM');
      expect(sql).toMatch(/"users"\."name" IS DISTINCT FROM "users"\."name"/);
    });

    it('should generate correct SQL for SQL Server', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(mssql).sql;
      expect(sql).toContain('IS DISTINCT FROM');
      expect(sql).toMatch(/\[users\]\.\[name\] IS DISTINCT FROM \[users\]\.\[name\]/);
    });

    it('should work with NULL values', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.deleted_at, null));
      const postgresSql = q.compile(postgres).sql;
      expect(postgresSql).toContain('IS DISTINCT FROM');
      
      const mysqlSql = q.compile(mysql).sql;
      expect(mysqlSql).toContain('NOT');
      expect(mysqlSql).toContain('<=>');
    });

    it('should work with string literals', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, 'John'));
      const sql = q.compile(postgres).sql;
      expect(sql).toContain('IS DISTINCT FROM');
      expect(sql).toContain('$1');
    });

    it('should work with numeric literals', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.id, 42));
      const sql = q.compile(postgres).sql;
      expect(sql).toContain('IS DISTINCT FROM');
    });
  });

  describe('isNotDistinctFrom', () => {
    it('should generate correct SQL for PostgreSQL', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(postgres).sql;
      expect(sql).toContain('IS NOT DISTINCT FROM');
      expect(sql).toMatch(/"users"\."name" IS NOT DISTINCT FROM "users"\."name"/);
    });

    it('should generate correct SQL for MySQL using spaceship operator', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(mysql).sql;
      expect(sql).toContain('<=>');
      expect(sql).not.toContain('NOT (');
      expect(sql).toMatch(/`users`\.`name` <=> `users`\.`name`/);
    });

    it('should generate correct SQL for SQLite', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(sqlite).sql;
      expect(sql).toContain('IS NOT DISTINCT FROM');
    });

    it('should generate correct SQL for SQL Server', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.name, Users.columns.name));
      const sql = q.compile(mssql).sql;
      expect(sql).toContain('IS NOT DISTINCT FROM');
    });

    it('should work with NULL values', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.deleted_at, null));
      const postgresSql = q.compile(postgres).sql;
      expect(postgresSql).toContain('IS NOT DISTINCT FROM');
      
      const mysqlSql = q.compile(mysql).sql;
      expect(mysqlSql).toContain('<=>');
      expect(mysqlSql).not.toContain('NOT (');
    });
  });

  describe('AST Generation', () => {
    it('should generate IsDistinctExpressionNode for isDistinctFrom', () => {
      const node = isDistinctFrom(Users.columns.name, 'test');
      expect(node.type).toBe('IsDistinctExpression');
      expect(node.operator).toBe('IS DISTINCT FROM');
    });

    it('should generate IsDistinctExpressionNode for isNotDistinctFrom', () => {
      const node = isNotDistinctFrom(Users.columns.name, 'test');
      expect(node.type).toBe('IsDistinctExpression');
      expect(node.operator).toBe('IS NOT DISTINCT FROM');
    });

    it('should accept ColumnRef on left side', () => {
      const node = isDistinctFrom({ table: 'users', name: 'name' }, 'test');
      expect(node.type).toBe('IsDistinctExpression');
    });

    it('should accept ColumnRef on right side', () => {
      const node = isDistinctFrom(Users.columns.name, { table: 'orders', name: 'status' });
      expect(node.type).toBe('IsDistinctExpression');
    });

    it('should accept literal values on right side', () => {
      const node1 = isDistinctFrom(Users.columns.name, 'test@example.com');
      const node2 = isDistinctFrom(Users.columns.id, 123);
      const node3 = isDistinctFrom(Users.columns.deleted_at, null);
      
      expect(node1.type).toBe('IsDistinctExpression');
      expect(node2.type).toBe('IsDistinctExpression');
      expect(node3.type).toBe('IsDistinctExpression');
    });
  });

  describe('cross-dialect compilation', () => {
    it('compiles isDistinctFrom across all dialects', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isDistinctFrom(Users.columns.name, Users.columns.role));

      expect(q.compile(sqlite).sql).toContain('"users"."name" IS DISTINCT FROM "users"."role"');
      expect(q.compile(postgres).sql).toContain('"users"."name" IS DISTINCT FROM "users"."role"');
      expect(q.compile(mysql).sql).toContain('NOT (`users`.`name` <=> `users`.`role`)');
      expect(q.compile(mssql).sql).toContain('[users].[name] IS DISTINCT FROM [users].[role]');
    });

    it('compiles isNotDistinctFrom across all dialects', () => {
      const q = new SelectQueryBuilder(Users).selectRaw('*').where(isNotDistinctFrom(Users.columns.name, Users.columns.role));

      expect(q.compile(sqlite).sql).toContain('"users"."name" IS NOT DISTINCT FROM "users"."role"');
      expect(q.compile(postgres).sql).toContain('"users"."name" IS NOT DISTINCT FROM "users"."role"');
      expect(q.compile(mysql).sql).toContain('`users`.`name` <=> `users`.`role`');
      expect(q.compile(mssql).sql).toContain('[users].[name] IS NOT DISTINCT FROM [users].[role]');
    });
  });
});
