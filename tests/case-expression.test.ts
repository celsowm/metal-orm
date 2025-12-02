import { describe, it, expect } from 'vitest';
import { Users } from '../src/playground/features/playground/data/schema';
import { caseWhen, gt, eq } from '../src/ast/expression';
import { SqliteDialect } from '../src/dialect/sqlite';
import { SelectQueryBuilder } from '../src/builder/select';

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

        const sql = query.toSql(dialect);
        expect(sql).toContain("CASE WHEN \"users\".\"id\" > 10 THEN 'High' WHEN \"users\".\"id\" > 5 THEN 'Medium' ELSE 'Low' END");
    });

    it('should compile CASE without ELSE', () => {
        const query = new SelectQueryBuilder(Users)
            .select({
                status: caseWhen([
                    { when: eq(Users.columns.name, 'Alice'), then: 'Admin' }
                ])
            });

        const sql = query.toSql(dialect);
        expect(sql).toContain("CASE WHEN \"users\".\"name\" = 'Alice' THEN 'Admin' END");
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

        const sql = query.toSql(dialect);
        expect(sql).toContain("WHERE CASE WHEN \"users\".\"id\" > 10 THEN 'High' ELSE 'Low' END = 'High'");
    });
});
