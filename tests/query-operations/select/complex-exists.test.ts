import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { TableDef, defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { eq, exists, and, outerRef, correlateBy } from '../../../src/core/ast/expression.js';

// Define test schema: Customers, Orders and Loyalty
const Customers = defineTable('customers', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    email: col.varchar(255),
}, {});

const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    customer_id: col.int(),
    order_date: col.varchar(50), // Storing dates as varchar for simplicity
    status: col.varchar(50),
    total: col.int(),
}, {});

const Loyalty = defineTable('loyalty', {
    id: col.primaryKey(col.int()),
    customer_id: col.int(),
    status: col.varchar(50),
    start_date: col.varchar(50), // Storing dates as varchar for simplicity
}, {});

// Define relationships
Customers.relations = {
    orders: {
        type: 'HAS_MANY',
        target: Orders,
        foreignKey: 'customer_id',
        localKey: 'id'
    },
    loyalty: {
        type: 'HAS_MANY',
        target: Loyalty,
        foreignKey: 'customer_id',
        localKey: 'id'
    }
};

Orders.relations = {
    customer: {
        type: 'BELONGS_TO',
        target: Customers,
        foreignKey: 'customer_id',
        localKey: 'id'
    }
};

Loyalty.relations = {
    customer: {
        type: 'BELONGS_TO',
        target: Customers,
        foreignKey: 'customer_id',
        localKey: 'id'
    }
};

const dialect = new SqliteDialect();

describe('Complex EXISTS Query Support', () => {
    it('should support EXISTS with date range AND another EXISTS', () => {
        // Build the subquery for orders in 2024
        const ordersIn2024 = new SelectQueryBuilder(Orders)
            .select({ dummy: col.int() }) // SELECT 1 (dummy)
            .where(and(
                eq(Orders.columns.customer_id, { type: 'Column', table: 'customers', name: 'id' }),
                // BETWEEN is not supported directly, so we use >= and <=
                and(
                    eq(Orders.columns.order_date, '2024-01-01'),
                    eq(Orders.columns.order_date, '2024-12-31')
                )
            ));

        // Build the subquery for active loyalty records
        const activeLoyalty = new SelectQueryBuilder(Loyalty)
            .select({ dummy: col.int() }) // SELECT 1 (dummy)
            .where(and(
                eq(Loyalty.columns.customer_id, { type: 'Column', table: 'customers', name: 'id' }),
                eq(Loyalty.columns.status, 'Active')
            ));

        // Main query
        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .where(and(
                exists(ordersIn2024.getAST()),
                exists(activeLoyalty.getAST())
            ));

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL:', sql);
        console.log('Parameters:', params);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "orders"');
        expect(sql).toContain('"orders"."customer_id" = "customers"."id"');
        expect(sql).toContain('"orders"."order_date"');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "loyalty"');
        expect(sql).toContain('"loyalty"."customer_id" = "customers"."id"');
        expect(sql).toContain('"loyalty"."status" = ?');
        expect(params).toContain('Active');
    });

    it('should support whereHas for both conditions', () => {
        // Use whereHas to simplify the EXISTS subquery construction
        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .whereHas('orders', (ordersQb) =>
                ordersQb.where(and(
                    eq(Orders.columns.order_date, '2024-01-01'),
                    eq(Orders.columns.order_date, '2024-12-31')
                ))
            )
            .whereHas('loyalty', (loyaltyQb) =>
                loyaltyQb.where(eq(Loyalty.columns.status, 'Active'))
            );

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL with whereHas:', sql);
        console.log('Parameters:', params);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "orders"');
        expect(sql).toContain('"orders"."customer_id" = "customers"."id"');
        expect(sql).toContain('"orders"."order_date"');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "loyalty"');
        expect(sql).toContain('"loyalty"."customer_id" = "customers"."id"');
        expect(sql).toContain('"loyalty"."status" = ?');
        expect(params).toContain('Active');
    });

    it('should generate correct SQL structure for complex EXISTS query', () => {
        // Test to ensure the generated SQL has the correct structure
        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .where(and(
                exists({
                    type: 'SelectQuery',
                    from: { type: 'Table', name: 'orders' },
                    columns: [{ type: 'Column', table: 'orders', name: 'id' }],
                    joins: [],
                    where: {
                        type: 'LogicalExpression',
                        operator: 'AND',
                        operands: [
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'orders', name: 'customer_id' },
                                operator: '=',
                                right: { type: 'Column', table: 'customers', name: 'id' }
                            },
                            {
                                type: 'LogicalExpression',
                                operator: 'AND',
                                operands: [
                                    {
                                        type: 'BinaryExpression',
                                        left: { type: 'Column', table: 'orders', name: 'order_date' },
                                        operator: '>=',
                                        right: { type: 'Literal', value: '2024-01-01' }
                                    },
                                    {
                                        type: 'BinaryExpression',
                                        left: { type: 'Column', table: 'orders', name: 'order_date' },
                                        operator: '<=',
                                        right: { type: 'Literal', value: '2024-12-31' }
                                    }
                                ]
                            }
                        ]
                    }
                }),
                exists({
                    type: 'SelectQuery',
                    from: { type: 'Table', name: 'loyalty' },
                    columns: [{ type: 'Column', table: 'loyalty', name: 'id' }],
                    joins: [],
                    where: {
                        type: 'LogicalExpression',
                        operator: 'AND',
                        operands: [
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'loyalty', name: 'customer_id' },
                                operator: '=',
                                right: { type: 'Column', table: 'customers', name: 'id' }
                            },
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'loyalty', name: 'status' },
                                operator: '=',
                                right: { type: 'Literal', value: 'Active' }
                            }
                        ]
                    }
                })
            ));

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL structure:', sql);
        console.log('Parameters:', params);

    // Check the overall structure of the query
    expect(sql).toContain('SELECT "customers"."name" AS "name" FROM "customers" WHERE');
    expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "orders"');
        expect(sql).toContain('"orders"."customer_id" = "customers"."id"');
        expect(sql).toContain('"orders"."order_date" >= ?');
        expect(sql).toContain('"orders"."order_date" <= ?');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "loyalty"');
        expect(sql).toContain('"loyalty"."customer_id" = "customers"."id"');
        expect(sql).toContain('"loyalty"."status" = ?');
        expect(params).toEqual(['2024-01-01', '2024-12-31', 'Active']);
    });

    it('supports EXISTS with a derived table source', () => {
        const ordersOpen = new SelectQueryBuilder(Orders)
            .select({ customer_id: Orders.columns.customer_id })
            .where(eq(Orders.columns.status, 'Open'));

        const existsFromDerived = new SelectQueryBuilder(Orders)
            .fromSubquery(ordersOpen, 'p_open')
            .select({ customer_id: Orders.columns.customer_id })
            .where(eq({ type: 'Column', table: 'p_open', name: 'customer_id' }, { type: 'Column', table: 'customers', name: 'id' }));

        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .whereExists(existsFromDerived);

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('FROM (SELECT "orders"."customer_id" AS "customer_id" FROM "orders" WHERE "orders"."status" = ?)');
        expect(sql).toContain('AS "p_open" WHERE "p_open"."customer_id" = "customers"."id"');
        expect(params).toEqual(['Open']);
    });

    it('allows manual correlation injection in whereExists (using outerRef)', () => {
        const paidOrders = new SelectQueryBuilder(Orders)
            .select({ id: Orders.columns.id })
            .where(eq(Orders.columns.status, 'Paid'));

        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .whereExists(
                paidOrders,
                eq(Orders.columns.customer_id, outerRef({ type: 'Column', table: 'customers', name: 'id' }))
            );

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('"orders"."status" = ?');
        expect(sql).toContain('"orders"."customer_id" = "customers"."id"');
        expect(params).toEqual(['Paid']);
    });

    it('supports additional correlation inside whereHas options', () => {
        const query = new SelectQueryBuilder(Customers)
            .select({ name: Customers.columns.name })
            .whereHas('orders', {
                correlate: eq(Orders.columns.status, 'Shipped')
            });

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('"orders"."customer_id" = "customers"."id"');
        expect(sql).toContain('"orders"."status" = ?');
        expect(params).toEqual(['Shipped']);
    });

    it('honors root table alias in correlations', () => {
        const query = new SelectQueryBuilder(Customers)
            .as('c')
            .select({ name: Customers.columns.name })
            .whereHas('orders', {
                correlate: eq(Orders.columns.status, 'Paid')
            });

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('FROM "customers" AS "c"');
        expect(sql).toContain('"orders"."customer_id" = "c"."id"');
        expect(sql).toContain('"orders"."status" = ?');
        expect(sql).toContain('"c"."name" AS "name"');
        expect(params).toEqual(['Paid']);
    });

    it('uses correlateBy helper for alias-aware outer refs', () => {
        const sub = new SelectQueryBuilder(Orders)
            .select({ id: Orders.columns.id })
            .where(eq(Orders.columns.status, 'Paid'));

        const query = new SelectQueryBuilder(Customers)
            .as('c')
            .select({ name: Customers.columns.name })
            .whereExists(sub, eq(Orders.columns.customer_id, correlateBy('c', 'id')));

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('"orders"."customer_id" = "c"."id"');
        expect(params).toEqual(['Paid']);
    });
});


