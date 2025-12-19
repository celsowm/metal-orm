import { describe, it, expect } from 'vitest';
import { bitAnd, bitOr, bitXor, shiftLeft, shiftRight } from '../../../src/core/ast/expression-builders.js';
import { Users } from '../../fixtures/schema.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';

describe('Bitwise Operators', () => {
    const sqlite = new SqliteDialect();
    const postgres = new PostgresDialect();
    const mysql = new MySqlDialect();
    const mssql = new SqlServerDialect();

    describe('AST Generation', () => {
        it('should generate BitwiseExpressionNode for bitAnd', () => {
            const node = bitAnd(Users.columns.id, 1);
            expect(node.type).toBe('BitwiseExpression');
            expect(node.operator).toBe('&');
        });

        it('should generate BitwiseExpressionNode for bitOr', () => {
            const node = bitOr(Users.columns.id, 1);
            expect(node.type).toBe('BitwiseExpression');
            expect(node.operator).toBe('|');
        });

        it('should generate BitwiseExpressionNode for bitXor', () => {
            const node = bitXor(Users.columns.id, 1);
            expect(node.type).toBe('BitwiseExpression');
            expect(node.operator).toBe('^');
        });

        it('should generate BitwiseExpressionNode for shiftLeft', () => {
            const node = shiftLeft(Users.columns.id, 1);
            expect(node.type).toBe('BitwiseExpression');
            expect(node.operator).toBe('<<');
        });

        it('should generate BitwiseExpressionNode for shiftRight', () => {
            const node = shiftRight(Users.columns.id, 1);
            expect(node.type).toBe('BitwiseExpression');
            expect(node.operator).toBe('>>');
        });
    });

    describe('SQL Compilation', () => {
        it('compiles bitwise AND across dialects', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('*').where(bitAnd(Users.columns.id, 1));

            expect(q.compile(sqlite).sql).toContain('"users"."id" & ?');
            expect(q.compile(postgres).sql).toContain('"users"."id" & ?');
            expect(q.compile(mysql).sql).toContain('`users`.`id` & ?');
            expect(q.compile(mssql).sql).toMatch(/\[users\]\.\[id\] & (@p1|\?)/);
        });

        it('compiles bitwise OR across dialects', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('*').where(bitOr(Users.columns.id, 1));

            expect(q.compile(sqlite).sql).toContain('"users"."id" | ?');
            expect(q.compile(postgres).sql).toContain('"users"."id" | ?');
            expect(q.compile(mysql).sql).toContain('`users`.`id` | ?');
            expect(q.compile(mssql).sql).toMatch(/\[users\]\.\[id\] \| (@p1|\?)/);
        });

        it('compiles bitwise XOR across dialects (including overrides)', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('*').where(bitXor(Users.columns.id, 1));

            // SQLite XOR emulation: (a | b) & ~(a & b)
            expect(q.compile(sqlite).sql).toContain('("users"."id" | ?) & ~("users"."id" & ?)');
            // Postgres XOR override: #
            expect(q.compile(postgres).sql).toContain('"users"."id" # ?');
            // MySQL/MSSQL default XOR: ^
            expect(q.compile(mysql).sql).toContain('`users`.`id` ^ ?');
            expect(q.compile(mssql).sql).toMatch(/\[users\]\.\[id\] \^ (@p1|\?)/);
        });

        it('compiles bitwise SHIFT LEFT across dialects', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('*').where(shiftLeft(Users.columns.id, 1));

            expect(q.compile(sqlite).sql).toContain('"users"."id" << ?');
            expect(q.compile(postgres).sql).toContain('"users"."id" << ?');
            expect(q.compile(mysql).sql).toContain('`users`.`id` << ?');
            expect(q.compile(mssql).sql).toMatch(/\[users\]\.\[id\] << (@p1|\?)/);
        });

        it('compiles bitwise SHIFT RIGHT across dialects', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('*').where(shiftRight(Users.columns.id, 1));

            expect(q.compile(sqlite).sql).toContain('"users"."id" >> ?');
            expect(q.compile(postgres).sql).toContain('"users"."id" >> ?');
            expect(q.compile(mysql).sql).toContain('`users`.`id` >> ?');
            expect(q.compile(mssql).sql).toMatch(/\[users\]\.\[id\] >> (@p1|\?)/);
        });

        it('handles bitwise expressions in SELECT clause with selectRaw', () => {
            const q = new SelectQueryBuilder(Users).selectRaw('("users"."id" & 255) AS "masked"');

            expect(q.compile(sqlite).sql).toContain('("users"."id" & 255) AS "masked"');
            expect(q.compile(postgres).sql).toContain('("users"."id" & 255) AS "masked"');
            expect(q.compile(mysql).sql).toContain('("users"."id" & 255) AS "masked"');
            expect(q.compile(mssql).sql).toContain('("users"."id" & 255) AS "masked"');
        });
    });
});
