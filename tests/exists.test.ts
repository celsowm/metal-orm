import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select';
import { SqliteDialect } from '../src/core/dialect/sqlite';
import { TableDef, defineTable } from '../src/schema/table';
import { col } from '../src/schema/column';
import { eq, gt, and } from '../src/core/ast/expression';

// Define test schema: Users and Orders
const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    email: col.varchar(255),
}, {});

const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    status: col.varchar(50),
    total: col.int(),
}, {});

// Define relationships
Users.relations = {
    orders: {
        type: 'HAS_MANY',
        target: Orders,
        foreignKey: 'user_id',
        localKey: 'id'
    }
};

Orders.relations = {
    user: {
        type: 'BELONGS_TO',
        target: Users,
        foreignKey: 'user_id',
        localKey: 'id'
    }
};

const dialect = new SqliteDialect();

describe('EXISTS Support', () => {
    describe('whereHas - basic functionality', () => {
        it('should generate EXISTS with simple correlation', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHas('orders');

            const compiled = query.compile(dialect);
            const { sql, params } = compiled;

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('SELECT 1 FROM');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
            expect(params).toEqual([]);
        });

        it('should support whereHas with filter callback', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHas('orders', (ordersQb) =>
                    ordersQb.where(eq(Orders.columns.status, 'completed'))
                );

            const compiled = query.compile(dialect);
            const { sql, params } = compiled;

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('"orders"."status" = ?');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
            expect(params).toEqual(['completed']);
        });

        it('should support whereHas with multiple filters', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHas('orders', (ordersQb) =>
                    ordersQb.where(and(
                        eq(Orders.columns.status, 'completed'),
                        gt(Orders.columns.total, 200)
                    ))
                );

            const compiled = query.compile(dialect);
            const { sql, params } = compiled;

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('"orders"."status" = ?');
            expect(sql).toContain('"orders"."total" > ?');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
            expect(params).toEqual(['completed', 200]);
        });
    });

    describe('whereHasNot - basic functionality', () => {
        it('should generate NOT EXISTS with simple correlation', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHasNot('orders');

            const compiled = query.compile(dialect);
            const { sql, params } = compiled;

            expect(sql).toContain('NOT EXISTS');
            expect(sql).toContain('SELECT 1 FROM');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
            expect(params).toEqual([]);
        });

        it('should support whereHasNot with filter callback', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHasNot('orders', (ordersQb) =>
                    ordersQb.where(eq(Orders.columns.status, 'pending'))
                );

            const compiled = query.compile(dialect);
            const { sql, params } = compiled;

            expect(sql).toContain('NOT EXISTS');
            expect(sql).toContain('"orders"."status" = ?');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
            expect(params).toEqual(['pending']);
        });
    });
});
