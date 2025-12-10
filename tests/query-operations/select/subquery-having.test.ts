import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { TableDef, defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column.js';
import { eq, gt, lt, avg, count, sum, min, max } from '../../../src/core/ast/expression.js';

// Define test schema
const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    age: col.int(),
}, {});

const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    status: col.varchar(50),
    total: col.int(),
}, {});

const Profiles = defineTable('profiles', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    display_name: col.varchar(255),
}, {});

const Contributions = defineTable('contributions', {
    id: col.primaryKey(col.int()),
    project_id: col.int(),
    hours: col.int(),
}, {});

const sqlite = new SqliteDialect();
const mysql = new MySqlDialect();
const sqlserver = new SqlServerDialect();

describe('Scalar Subqueries', () => {
    describe('selectSubquery in SELECT projection', () => {
        it('should add scalar subquery to SELECT (SQLite)', () => {
            const profileSubquery = new SelectQueryBuilder(Profiles)
                .select({ display_name: Profiles.columns.display_name })
                .where(eq(Profiles.columns.user_id, Users.columns.id));

            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id })
                .selectSubquery('profile_name', profileSubquery);

            const sql = query.toSql(sqlite);

            expect(sql).toContain('(SELECT');
            expect(sql).toContain('"profiles"."display_name"');
            expect(sql).toContain('AS "profile_name"');
        });

        it('should support multiple scalar subqueries', () => {
            const orderCountSub = new SelectQueryBuilder(Orders)
                .select({ cnt: count(Orders.columns.id) })
                .where(eq(Orders.columns.user_id, Users.columns.id));

            const totalSpentSub = new SelectQueryBuilder(Orders)
                .select({ total: sum(Orders.columns.total) })
                .where(eq(Orders.columns.user_id, Users.columns.id));

            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id })
                .selectSubquery('order_count', orderCountSub)
                .selectSubquery('total_spent', totalSpentSub);

            const sql = query.toSql(sqlite);
            expect(sql).toContain('AS "order_count"');
            expect(sql).toContain('AS "total_spent"');
        });
    });

    describe('Scalar subquery in WHERE clause', () => {
        it('should support scalar subquery with gt operator', () => {
            const avgAgeSub = new SelectQueryBuilder(Users)
                .select({ avg_age: avg(Users.columns.age) });

            const query = new SelectQueryBuilder(Users)
                .select({ id: Users.columns.id, age: Users.columns.age })
                .where(gt(Users.columns.age, {
                    type: 'ScalarSubquery',
                    query: avgAgeSub.getAST()
                }));

            const sql = query.toSql(sqlite);
            expect(sql).toContain('"users"."age" >');
            expect(sql).toContain('(SELECT');
            expect(sql).toContain('AVG("users"."age")');
        });
    });
});

describe('HAVING Clause', () => {
    describe('Basic HAVING with aggregates', () => {
        it('should add HAVING clause with COUNT (SQLite)', () => {
        const query = new SelectQueryBuilder(Contributions)
            .select({ project_id: Contributions.columns.project_id, cnt: count(Contributions.columns.id) })
            .groupBy(Contributions.columns.project_id)
            .having(gt(count(Contributions.columns.id), 10));

        const compiled = query.compile(sqlite);
        const { sql, params } = compiled;

        expect(sql).toContain('GROUP BY');
        expect(sql).toContain('HAVING');
        expect(sql).toContain('COUNT("contributions"."id") > ?');
        expect(params).toEqual([10]);

        const groupByIndex = sql.indexOf('GROUP BY');
        const havingIndex = sql.indexOf('HAVING');
        expect(havingIndex).toBeGreaterThan(groupByIndex);
        });

        it('should add HAVING clause with SUM (MySQL)', () => {
        const query = new SelectQueryBuilder(Contributions)
            .select({ project_id: Contributions.columns.project_id, hours: sum(Contributions.columns.hours) })
            .groupBy(Contributions.columns.project_id)
            .having(gt(sum(Contributions.columns.hours), 100));

        const compiled = query.compile(mysql);
        const { sql, params } = compiled;

        expect(sql).toContain('GROUP BY');
        expect(sql).toContain('HAVING');
        expect(sql).toContain('SUM(`contributions`.`hours`) > ?');
        expect(params).toEqual([100]);
        });

        it('should add HAVING clause with AVG (SQL Server)', () => {
        const query = new SelectQueryBuilder(Orders)
            .select({ user_id: Orders.columns.user_id, avg_total: avg(Orders.columns.total) })
            .groupBy(Orders.columns.user_id)
            .having(gt(avg(Orders.columns.total), 500));

        const compiled = query.compile(sqlserver);
        const { sql, params } = compiled;

        expect(sql).toContain('GROUP BY');
        expect(sql).toContain('HAVING');
        expect(sql).toContain('AVG([orders].[total]) > @p1');
        expect(params).toEqual([500]);
        });

        it('should add HAVING clause with MIN (SQLite)', () => {
        const query = new SelectQueryBuilder(Orders)
            .select({ user_id: Orders.columns.user_id, min_total: min(Orders.columns.total) })
            .groupBy(Orders.columns.user_id)
            .having(gt(min(Orders.columns.total), 50));

        const compiled = query.compile(sqlite);
        const { sql, params } = compiled;

        expect(sql).toContain('MIN("orders"."total") > ?');
        expect(params).toEqual([50]);
        });

        it('should add HAVING clause with MAX (MySQL)', () => {
        const query = new SelectQueryBuilder(Orders)
            .select({ user_id: Orders.columns.user_id, max_total: max(Orders.columns.total) })
            .groupBy(Orders.columns.user_id)
            .having(gt(max(Orders.columns.total), 250));

        const compiled = query.compile(mysql);
        const { sql, params } = compiled;

        expect(sql).toContain('MAX(`orders`.`total`) > ?');
        expect(params).toEqual([250]);
        });
    });

    describe('Multiple HAVING conditions', () => {
        it('should combine multiple HAVING calls with AND', () => {
        const query = new SelectQueryBuilder(Contributions)
            .select({ project_id: Contributions.columns.project_id, cnt: count(Contributions.columns.id) })
            .groupBy(Contributions.columns.project_id)
            .having(gt(count(Contributions.columns.id), 5))
            .having(lt(sum(Contributions.columns.hours), 200));

        const compiled = query.compile(sqlite);
        const { sql, params } = compiled;

        expect(sql).toContain('HAVING');
        expect(sql).toContain('AND');
        expect(sql).toContain('COUNT("contributions"."id") > ?');
        expect(sql).toContain('SUM("contributions"."hours") < ?');
        expect(params).toEqual([5, 200]);
        });
    });

    describe('SQL clause ordering', () => {
        it('should maintain correct clause order: WHERE > GROUP BY > HAVING > ORDER BY', () => {
            const query = new SelectQueryBuilder(Orders)
                .select({ status: Orders.columns.status, cnt: count(Orders.columns.id) })
                .where(gt(Orders.columns.total, 0))
                .groupBy(Orders.columns.status)
                .having(gt(count(Orders.columns.id), 10))
                .orderBy(Orders.columns.status, 'ASC');

        const compiled = query.compile(sqlite);
        const { sql, params } = compiled;

        const whereIdx = sql.indexOf('WHERE');
        const groupByIdx = sql.indexOf('GROUP BY');
        const havingIdx = sql.indexOf('HAVING');
        const orderByIdx = sql.indexOf('ORDER BY');

        expect(whereIdx).toBeGreaterThan(-1);
        expect(groupByIdx).toBeGreaterThan(whereIdx);
        expect(havingIdx).toBeGreaterThan(groupByIdx);
        expect(orderByIdx).toBeGreaterThan(havingIdx);
        expect(params).toEqual([0, 10]);
        });
    });
});
