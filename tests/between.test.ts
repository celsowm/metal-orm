import { describe, it, expect } from 'vitest';
import { between, notBetween, eq } from '../src/ast/expression';
import { Users, Orders } from '../src/playground/features/playground/data/schema';
import { SqliteDialect } from '../src/dialect/sqlite';
import { SelectQueryBuilder } from '../src/builder/select';

describe('between', () => {
    const dialect = new SqliteDialect();

    it('should handle a basic BETWEEN condition', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(between(Users.columns.id, 1, 10));
        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."id" BETWEEN ? AND ?;'
        );
        expect(compiled.params).toEqual([1, 10]);
    });

    it('should handle a NOT BETWEEN condition', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(notBetween(Users.columns.id, 1, 10));
        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."id" NOT BETWEEN ? AND ?;'
        );
        expect(compiled.params).toEqual([1, 10]);
    });

    it('should handle multiple conditions', () => {
        const q = new SelectQueryBuilder(Orders)
            .selectRaw('*')
            .where(between(Orders.columns.total, 100, 200))
            .where(eq(Orders.columns.user_id, 1));
        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "orders"."*" FROM "orders" WHERE "orders"."total" BETWEEN ? AND ? AND "orders"."user_id" = ?;'
        );
        expect(compiled.params).toEqual([100, 200, 1]);
    });
});
