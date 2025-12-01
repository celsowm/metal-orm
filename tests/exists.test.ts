import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/builder/select';
import { SqliteDialect } from '../src/dialect/sqlite';
import { TableDef, defineTable } from '../src/schema/table';
import { col } from '../src/schema/column';
import { eq, gt, and } from '../src/ast/expression';

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

            const sql = query.toSql(dialect);

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('SELECT 1 FROM');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
        });

        it('should support whereHas with filter callback', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHas('orders', (ordersQb) =>
                    ordersQb.where(eq(Orders.columns.status, 'completed'))
                );

            const sql = query.toSql(dialect);

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('"orders"."status" = \'completed\'');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
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

            const sql = query.toSql(dialect);

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('"orders"."status" = \'completed\'');
            expect(sql).toContain('"orders"."total" > 200');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
        });
    });

    describe('whereHasNot - basic functionality', () => {
        it('should generate NOT EXISTS with simple correlation', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHasNot('orders');

            const sql = query.toSql(dialect);

            expect(sql).toContain('NOT EXISTS');
            expect(sql).toContain('SELECT 1 FROM');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
        });

        it('should support whereHasNot with filter callback', () => {
            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, name: Users.columns.name })
                .whereHasNot('orders', (ordersQb) =>
                    ordersQb.where(eq(Orders.columns.status, 'pending'))
                );

            const sql = query.toSql(dialect);

            expect(sql).toContain('NOT EXISTS');
            expect(sql).toContain('"orders"."status" = \'pending\'');
            expect(sql).toContain('"orders"."user_id" = "users"."id"');
        });
    });
});
