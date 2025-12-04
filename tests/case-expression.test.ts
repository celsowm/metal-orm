import { describe, it, expect } from 'vitest';
import { Users } from '../src/playground/features/playground/data/schema';
import { caseWhen, gt, eq } from '../src/core/ast/expression';
import { SqliteDialect } from '../src/core/dialect/sqlite';
import { SelectQueryBuilder } from '../src/query-builder/select';

describe('CASE Expressions', () => {
    const dialect = new SqliteDialect();

    it('should compile simple CASE WHEN ... THEN ... ELSE ... END', () => {
        const query = new SelectQueryBuilder(Users)
            .select({
                status: caseWhen([
                    { when: gt(Users.columns.id, 10), then: 'High' },
                    { when: gt(Users.columns.id, 5), then: 'Medium' }
                ], 'Low')
            });

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        expect(sql).toContain('CASE WHEN "users"."id" > ? THEN ? WHEN "users"."id" > ? THEN ? ELSE ? END');
        expect(params).toEqual([10, 'High', 5, 'Medium', 'Low']);
    });

    it('should compile CASE without ELSE', () => {
        const query = new SelectQueryBuilder(Users)
            .select({
                status: caseWhen([
                    { when: eq(Users.columns.name, 'Alice'), then: 'Admin' }
                ])
            });

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        expect(sql).toContain('CASE WHEN "users"."name" = ? THEN ? END');
        expect(params).toEqual(['Alice', 'Admin']);
    });

    it('should work in WHERE clause', () => {
        const query = new SelectQueryBuilder(Users)
            .where(
                eq(
                    caseWhen([
                        { when: gt(Users.columns.id, 10), then: 'High' }
                    ], 'Low'),
                    'High'
                )
            );

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        expect(sql).toContain('WHERE CASE WHEN "users"."id" > ? THEN ? ELSE ? END = ?');
        expect(params).toEqual([10, 'High', 'Low', 'High']);
    });
});
