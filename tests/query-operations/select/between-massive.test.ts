import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    between,
    notBetween,
    eq,
    and,
    or,
    gt,
    lt,
    neq,
    isNull,
    isNotNull,
    like
} from '../../../src/core/ast/expression.js';
import { Users, Orders, Profiles, Roles, UserRoles, Projects, ProjectAssignments } from '../../fixtures/schema.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { Connection, Request, TYPES } from 'tedious';
import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import { Orm } from '../../../src/orm/orm.js';
import { OrmSession } from '../../../src/orm/orm-session.js';

describe('BETWEEN Expression - Massive Test Suite', () => {
    const sqliteDialect = new SqliteDialect();
    const mysqlDialect = new MySqlDialect();
    const postgresDialect = new PostgresDialect();
    const mssqlDialect = new SqlServerDialect();

    // ==========================================================================
    // SECTION 1: Basic BETWEEN functionality
    // ==========================================================================
    describe('Basic BETWEEN', () => {
        it('should handle integer range', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });

        it('should handle negative integer range', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, -100, -10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "orders"."*" FROM "orders" WHERE "orders"."total" BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([-100, -10]);
        });

        it('should handle zero as lower bound', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 0, 50));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0, 50]);
        });

        it('should handle zero as upper bound', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, -50, 0));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([-50, 0]);
        });

        it('should handle same lower and upper bound', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 5, 5));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([5, 5]);
        });

        it('should handle large integer values', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1000000, 9999999));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1000000, 9999999]);
        });

        it('should handle floating point numbers', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 10.5, 99.99));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([10.5, 99.99]);
        });

        it('should handle string range for VARCHAR columns', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, 'A', 'M'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."name" BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual(['A', 'M']);
        });

        it('should handle string range with multiple characters', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, 'Alice', 'Bob'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['Alice', 'Bob']);
        });
    });

    // ==========================================================================
    // SECTION 2: Basic NOT BETWEEN functionality
    // ==========================================================================
    describe('Basic NOT BETWEEN', () => {
        it('should handle integer range', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(notBetween(Users.columns.id, 1, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" NOT BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });

        it('should handle negative integer range', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, -100, -10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "orders"."*" FROM "orders" WHERE "orders"."total" NOT BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([-100, -10]);
        });

        it('should handle zero boundaries', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, 0, 0));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0, 0]);
        });

        it('should handle floating point numbers', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, 0.01, 0.99));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0.01, 0.99]);
        });

        it('should handle string range', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(notBetween(Users.columns.role, 'admin', 'user'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."role" NOT BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual(['admin', 'user']);
        });
    });

    // ==========================================================================
    // SECTION 3: Multiple BETWEEN conditions (chained)
    // ==========================================================================
    describe('Multiple BETWEEN conditions (AND chaining)', () => {
        it('should chain two BETWEEN conditions on same table', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 50))
                .where(between(Orders.columns.total, 100, 500));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "orders"."*" FROM "orders" WHERE "orders"."id" BETWEEN ? AND ? AND "orders"."total" BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 50, 100, 500]);
        });

        it('should chain three BETWEEN conditions', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 10))
                .where(between(Orders.columns.user_id, 100, 200))
                .where(between(Orders.columns.total, 50, 150));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 10, 100, 200, 50, 150]);
        });

        it('should chain BETWEEN and NOT BETWEEN conditions', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 100))
                .where(notBetween(Orders.columns.total, 0, 10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "orders"."*" FROM "orders" WHERE "orders"."id" BETWEEN ? AND ? AND "orders"."total" NOT BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 100, 0, 10]);
        });

        it('should chain NOT BETWEEN and BETWEEN conditions', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(notBetween(Users.columns.id, 50, 100))
                .where(between(Users.columns.id, 1, 200));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([50, 100, 1, 200]);
        });

        it('should chain multiple NOT BETWEEN conditions', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(notBetween(Users.columns.id, 1, 10))
                .where(notBetween(Users.columns.id, 90, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 10, 90, 100]);
        });
    });

    // ==========================================================================
    // SECTION 4: BETWEEN combined with other operators
    // ==========================================================================
    describe('BETWEEN combined with other operators', () => {
        it('should combine BETWEEN with eq', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 100, 500))
                .where(eq(Orders.columns.user_id, 1));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "orders"."*" FROM "orders" WHERE "orders"."total" BETWEEN ? AND ? AND "orders"."user_id" = ?;'
            );
            expect(compiled.params).toEqual([100, 500, 1]);
        });

        it('should combine BETWEEN with ne', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 100, 500))
                .where(neq(Orders.columns.status, 'cancelled'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([100, 500, 'cancelled']);
        });

        it('should combine BETWEEN with gt', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 100))
                .where(gt(Orders.columns.total, 50));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 100, 50]);
        });

        it('should combine BETWEEN with lt', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 100))
                .where(lt(Orders.columns.total, 1000));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 100, 1000]);
        });

        it('should combine BETWEEN with isNull', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100))
                .where(isNull(Users.columns.deleted_at));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN ? AND ?');
            expect(compiled.sql).toContain('IS NULL');
        });

        it('should combine BETWEEN with isNotNull', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100))
                .where(isNotNull(Users.columns.name));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('IS NOT NULL');
        });

        it('should combine BETWEEN with LIKE', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100))
                .where(like(Users.columns.name, 'John%'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('LIKE');
            expect(compiled.params).toEqual([1, 100, 'John%']);
        });

        it('should combine NOT BETWEEN with eq', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, 0, 10))
                .where(eq(Orders.columns.status, 'completed'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0, 10, 'completed']);
        });
    });

    // ==========================================================================
    // SECTION 5: BETWEEN with logical operators (AND, OR)
    // ==========================================================================
    describe('BETWEEN with logical operators', () => {
        it('should use BETWEEN inside explicit AND', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(and(
                    between(Users.columns.id, 1, 50),
                    eq(Users.columns.role, 'admin')
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN ? AND ?');
            expect(compiled.sql).toContain('AND');
        });

        it('should use BETWEEN inside OR', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(or(
                    between(Users.columns.id, 1, 10),
                    between(Users.columns.id, 90, 100)
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('OR');
            expect(compiled.params).toEqual([1, 10, 90, 100]);
        });

        it('should combine BETWEEN and NOT BETWEEN with OR', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(or(
                    between(Orders.columns.total, 100, 200),
                    notBetween(Orders.columns.total, 500, 1000)
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('NOT BETWEEN');
            expect(compiled.sql).toContain('OR');
        });

        it('should handle nested AND/OR with BETWEEN', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(and(
                    or(
                        between(Users.columns.id, 1, 10),
                        between(Users.columns.id, 90, 100)
                    ),
                    eq(Users.columns.role, 'admin')
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('OR');
            expect(compiled.sql).toContain('AND');
        });

        it('should handle complex nested logic with multiple BETWEEN', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(or(
                    and(
                        between(Orders.columns.id, 1, 100),
                        between(Orders.columns.total, 50, 200)
                    ),
                    and(
                        between(Orders.columns.id, 200, 300),
                        between(Orders.columns.total, 500, 1000)
                    )
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 100, 50, 200, 200, 300, 500, 1000]);
        });

        it('should handle triple nested logic with BETWEEN', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(or(
                    and(
                        between(Users.columns.id, 1, 10),
                        or(
                            eq(Users.columns.role, 'admin'),
                            eq(Users.columns.role, 'superadmin')
                        )
                    ),
                    notBetween(Users.columns.id, 90, 100)
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('NOT BETWEEN');
        });
    });

    // ==========================================================================
    // SECTION 6: Multi-dialect support
    // ==========================================================================
    describe('Multi-dialect BETWEEN support', () => {
        const query = () => new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(between(Users.columns.id, 1, 100));

        it('should compile correctly for SQLite', () => {
            const compiled = query().compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });

        it('should compile correctly for MySQL', () => {
            const compiled = query().compile(mysqlDialect);
            expect(compiled.sql).toBe(
                'SELECT `users`.`*` FROM `users` WHERE `users`.`id` BETWEEN ? AND ?;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });

        it('should compile correctly for PostgreSQL', () => {
            const compiled = query().compile(postgresDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" BETWEEN $1 AND $2;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });

        it('should compile correctly for MSSQL', () => {
            const compiled = query().compile(mssqlDialect);
            expect(compiled.sql).toBe(
                'SELECT [users].[*] FROM [users] WHERE [users].[id] BETWEEN @p1 AND @p2;'
            );
            expect(compiled.params).toEqual([1, 100]);
        });
    });

    describe('Multi-dialect NOT BETWEEN support', () => {
        const query = () => new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(notBetween(Users.columns.id, 50, 75));

        it('should compile NOT BETWEEN correctly for SQLite', () => {
            const compiled = query().compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" NOT BETWEEN ? AND ?;'
            );
        });

        it('should compile NOT BETWEEN correctly for MySQL', () => {
            const compiled = query().compile(mysqlDialect);
            expect(compiled.sql).toBe(
                'SELECT `users`.`*` FROM `users` WHERE `users`.`id` NOT BETWEEN ? AND ?;'
            );
        });

        it('should compile NOT BETWEEN correctly for PostgreSQL', () => {
            const compiled = query().compile(postgresDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."id" NOT BETWEEN $1 AND $2;'
            );
        });

        it('should compile NOT BETWEEN correctly for MSSQL', () => {
            const compiled = query().compile(mssqlDialect);
            expect(compiled.sql).toBe(
                'SELECT [users].[*] FROM [users] WHERE [users].[id] NOT BETWEEN @p1 AND @p2;'
            );
        });
    });

    describe('Multi-dialect complex BETWEEN queries', () => {
        const complexQuery = () => new SelectQueryBuilder(Orders)
            .selectRaw('*')
            .where(between(Orders.columns.id, 1, 100))
            .where(notBetween(Orders.columns.total, 0, 10))
            .where(eq(Orders.columns.status, 'active'));

        it('should handle complex query for SQLite', () => {
            const compiled = complexQuery().compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 100, 0, 10, 'active']);
        });

        it('should handle complex query for MySQL', () => {
            const compiled = complexQuery().compile(mysqlDialect);
            expect(compiled.params).toEqual([1, 100, 0, 10, 'active']);
        });

        it('should handle complex query for PostgreSQL', () => {
            const compiled = complexQuery().compile(postgresDialect);
            expect(compiled.params).toEqual([1, 100, 0, 10, 'active']);
        });

        it('should handle complex query for MSSQL', () => {
            const compiled = complexQuery().compile(mssqlDialect);
            expect(compiled.params).toEqual([1, 100, 0, 10, 'active']);
        });
    });

    // ==========================================================================
    // SECTION 7: Different column types
    // ==========================================================================
    describe('BETWEEN on different column types', () => {
        it('should work on primary key column', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"users"."id" BETWEEN');
        });

        it('should work on foreign key column', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.user_id, 1, 50));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"orders"."user_id" BETWEEN');
        });

        it('should work on integer column', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 100, 999));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"orders"."total" BETWEEN');
        });

        it('should work on varchar column', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, 'A', 'Z'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"users"."name" BETWEEN');
        });

        it('should work on role/status varchar column', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.role, 'admin', 'user'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"users"."role" BETWEEN');
        });
    });

    // ==========================================================================
    // SECTION 8: Different tables
    // ==========================================================================
    describe('BETWEEN on different tables', () => {
        it('should work on Users table', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "users"');
        });

        it('should work on Orders table', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "orders"');
        });

        it('should work on Profiles table', () => {
            const q = new SelectQueryBuilder(Profiles)
                .selectRaw('*')
                .where(between(Profiles.columns.id, 1, 50));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "profiles"');
        });

        it('should work on Roles table', () => {
            const q = new SelectQueryBuilder(Roles)
                .selectRaw('*')
                .where(between(Roles.columns.id, 1, 10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "roles"');
        });

        it('should work on UserRoles table', () => {
            const q = new SelectQueryBuilder(UserRoles)
                .selectRaw('*')
                .where(between(UserRoles.columns.id, 1, 1000));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "user_roles"');
        });

        it('should work on Projects table', () => {
            const q = new SelectQueryBuilder(Projects)
                .selectRaw('*')
                .where(between(Projects.columns.id, 1, 25));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "projects"');
        });

        it('should work on ProjectAssignments table', () => {
            const q = new SelectQueryBuilder(ProjectAssignments)
                .selectRaw('*')
                .where(between(ProjectAssignments.columns.id, 1, 500));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('FROM "project_assignments"');
        });
    });

    // ==========================================================================
    // SECTION 9: Edge cases and boundary values
    // ==========================================================================
    describe('Edge cases and boundary values', () => {
        it('should handle MAX_SAFE_INTEGER boundaries', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 0, Number.MAX_SAFE_INTEGER));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0, Number.MAX_SAFE_INTEGER]);
        });

        it('should handle MIN_SAFE_INTEGER to MAX_SAFE_INTEGER', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
        });

        it('should handle very small decimal values', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 0.0001, 0.0002));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([0.0001, 0.0002]);
        });

        it('should handle inverted range (upper < lower) - SQL will return no results but should compile', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 100, 1));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([100, 1]);
        });

        it('should handle empty string boundaries', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, '', 'Z'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['', 'Z']);
        });

        it('should handle unicode string boundaries', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, '日本語', '한국어'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['日本語', '한국어']);
        });

        it('should handle special characters in string boundaries', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, '@admin', '#user'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['@admin', '#user']);
        });

        it('should handle whitespace in string boundaries', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, '  Alice  ', '  Bob  '));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['  Alice  ', '  Bob  ']);
        });
    });

    // ==========================================================================
    // SECTION 10: Column to column comparisons (if supported)
    // ==========================================================================
    describe('Column references in BETWEEN', () => {
        it('should handle column reference as left operand', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"users"."id" BETWEEN');
        });

        it('should handle multiple columns from same table', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 50))
                .where(between(Orders.columns.user_id, 10, 20))
                .where(between(Orders.columns.total, 100, 500));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 50, 10, 20, 100, 500]);
        });
    });

    // ==========================================================================
    // SECTION 11: Select with specific columns + BETWEEN
    // ==========================================================================
    describe('BETWEEN with column selection', () => {
        it('should work with selectRaw *', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('SELECT "users"."*"');
        });

        it('should work with specific column selection', () => {
            const q = new SelectQueryBuilder(Users)
                .select('id', 'name')
                .where(between(Users.columns.id, 1, 10));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('"users"."id"');
            expect(compiled.sql).toContain('"users"."name"');
        });

        it('should work with multiple selected columns and BETWEEN', () => {
            const q = new SelectQueryBuilder(Orders)
                .select('id', 'total', 'status')
                .where(between(Orders.columns.total, 50, 500));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
        });
    });

    // ==========================================================================
    // SECTION 12: BETWEEN with ORDER BY
    // ==========================================================================
    describe('BETWEEN with ORDER BY', () => {
        it('should combine BETWEEN with ORDER BY ASC', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100))
                .orderBy(Users.columns.id, 'ASC');
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('ORDER BY');
            expect(compiled.sql).toContain('ASC');
        });

        it('should combine BETWEEN with ORDER BY DESC', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 100))
                .orderBy(Users.columns.id, 'DESC');
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('DESC');
        });

        it('should combine NOT BETWEEN with ORDER BY', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, 0, 10))
                .orderBy(Orders.columns.total, 'ASC');
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('NOT BETWEEN');
            expect(compiled.sql).toContain('ORDER BY');
        });

        it('should combine BETWEEN with multiple ORDER BY columns', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 100, 1000))
                .orderBy(Orders.columns.user_id, 'ASC')
                .orderBy(Orders.columns.total, 'DESC');
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
        });
    });

    // ==========================================================================
    // SECTION 13: BETWEEN with LIMIT and OFFSET
    // ==========================================================================
    describe('BETWEEN with LIMIT and OFFSET', () => {
        it('should combine BETWEEN with LIMIT', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 1000))
                .limit(10);
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('LIMIT');
        });

        it('should combine BETWEEN with LIMIT and OFFSET', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 1000))
                .limit(10)
                .offset(20);
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('LIMIT');
            expect(compiled.sql).toContain('OFFSET');
        });

        it('should combine NOT BETWEEN with pagination', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(notBetween(Orders.columns.total, 0, 50))
                .limit(25)
                .offset(50);
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('NOT BETWEEN');
        });
    });

    // ==========================================================================
    // SECTION 14: BETWEEN combined with full query features
    // ==========================================================================
    describe('BETWEEN with full query features', () => {
        it('should work with WHERE + ORDER BY + LIMIT', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 1, 500))
                .orderBy(Users.columns.name, 'ASC')
                .limit(50);
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('WHERE');
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.sql).toContain('ORDER BY');
            expect(compiled.sql).toContain('LIMIT');
        });

        it('should work with complex WHERE + ORDER BY + LIMIT + OFFSET', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 100, 10000))
                .where(eq(Orders.columns.status, 'completed'))
                .orderBy(Orders.columns.total, 'DESC')
                .limit(20)
                .offset(40);
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params[0]).toBe(100);
            expect(compiled.params[1]).toBe(10000);
            expect(compiled.params[2]).toBe('completed');
        });
    });

    // ==========================================================================
    // SECTION 15: Numeric precision tests
    // ==========================================================================
    describe('Numeric precision in BETWEEN', () => {
        it('should handle decimal precision', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 99.99, 100.01));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([99.99, 100.01]);
        });

        it('should handle scientific notation', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 1e6, 1e9));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1e6, 1e9]);
        });

        it('should handle negative decimals', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, -99.99, -0.01));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([-99.99, -0.01]);
        });
    });

    // ==========================================================================
    // SECTION 16: AST node structure verification
    // ==========================================================================
    describe('AST node structure', () => {
        it('should create correct BetweenExpressionNode structure', () => {
            const expr = between(Users.columns.id, 1, 100);
            expect(expr.type).toBe('BetweenExpression');
            expect(expr.operator).toBe('BETWEEN');
            expect(expr.left).toBeDefined();
            expect(expr.lower).toBeDefined();
            expect(expr.upper).toBeDefined();
        });

        it('should create correct NOT BetweenExpressionNode structure', () => {
            const expr = notBetween(Users.columns.id, 1, 100);
            expect(expr.type).toBe('BetweenExpression');
            expect(expr.operator).toBe('NOT BETWEEN');
        });

        it('should correctly convert column ref to column node', () => {
            const expr = between(Users.columns.id, 1, 100);
            expect(expr.left.type).toBe('Column');
            if (expr.left.type === 'Column') {
                expect(expr.left.table).toBe('users');
                expect(expr.left.name).toBe('id');
            }
        });

        it('should correctly convert literal bounds', () => {
            const expr = between(Users.columns.id, 1, 100);
            expect(expr.lower.type).toBe('Literal');
            expect(expr.upper.type).toBe('Literal');
            if (expr.lower.type === 'Literal') {
                expect(expr.lower.value).toBe(1);
            }
            if (expr.upper.type === 'Literal') {
                expect(expr.upper.value).toBe(100);
            }
        });

        it('should handle string literals in AST', () => {
            const expr = between(Users.columns.name, 'A', 'Z');
            if (expr.lower.type === 'Literal') {
                expect(expr.lower.value).toBe('A');
            }
            if (expr.upper.type === 'Literal') {
                expect(expr.upper.value).toBe('Z');
            }
        });
    });

    // ==========================================================================
    // SECTION 17: Parameter ordering verification
    // ==========================================================================
    describe('Parameter ordering', () => {
        it('should maintain parameter order in simple query', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.id, 10, 20));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params[0]).toBe(10);
            expect(compiled.params[1]).toBe(20);
        });

        it('should maintain parameter order with multiple conditions', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(eq(Orders.columns.status, 'active'))
                .where(between(Orders.columns.total, 100, 500))
                .where(eq(Orders.columns.user_id, 42));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['active', 100, 500, 42]);
        });

        it('should maintain parameter order with BETWEEN first', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.total, 50, 150))
                .where(eq(Orders.columns.status, 'pending'))
                .where(between(Orders.columns.id, 1, 1000));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([50, 150, 'pending', 1, 1000]);
        });

        it('should maintain parameter order in complex nested conditions', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(or(
                    and(
                        between(Users.columns.id, 1, 10),
                        eq(Users.columns.role, 'admin')
                    ),
                    between(Users.columns.id, 100, 200)
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 10, 'admin', 100, 200]);
        });
    });

    // ==========================================================================
    // SECTION 18: Stress tests - many conditions
    // ==========================================================================
    describe('Stress tests with many BETWEEN conditions', () => {
        it('should handle 5 chained BETWEEN conditions', () => {
            const q = new SelectQueryBuilder(Orders)
                .selectRaw('*')
                .where(between(Orders.columns.id, 1, 10))
                .where(between(Orders.columns.id, 11, 20))
                .where(between(Orders.columns.id, 21, 30))
                .where(between(Orders.columns.id, 31, 40))
                .where(between(Orders.columns.id, 41, 50));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toHaveLength(10);
        });

        it('should handle 10 alternating BETWEEN/NOT BETWEEN conditions', () => {
            let q = new SelectQueryBuilder(Users).selectRaw('*');
            for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                    q = q.where(between(Users.columns.id, i * 10, (i + 1) * 10));
                } else {
                    q = q.where(notBetween(Users.columns.id, i * 10, (i + 1) * 10));
                }
            }
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toHaveLength(20);
        });

        it('should handle deeply nested OR conditions with BETWEEN', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(or(
                    between(Users.columns.id, 1, 10),
                    or(
                        between(Users.columns.id, 20, 30),
                        or(
                            between(Users.columns.id, 40, 50),
                            or(
                                between(Users.columns.id, 60, 70),
                                between(Users.columns.id, 80, 90)
                            )
                        )
                    )
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual([1, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
        });
    });

    // ==========================================================================
    // SECTION 19: SQL injection safety (parameterization check)
    // ==========================================================================
    describe('SQL injection safety', () => {
        it('should parameterize malicious string lower bound', () => {
            const malicious = "1'; DROP TABLE users; --";
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, malicious, 'Z'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params[0]).toBe(malicious);
            expect(compiled.sql).not.toContain('DROP TABLE');
        });

        it('should parameterize malicious string upper bound', () => {
            const malicious = "1 OR 1=1; --";
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(Users.columns.name, 'A', malicious));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params[1]).toBe(malicious);
            expect(compiled.sql).not.toContain('1=1');
        });

        it('should handle both bounds as malicious strings', () => {
            const q = new SelectQueryBuilder(Users)
                .selectRaw('*')
                .where(between(
                    Users.columns.name,
                    "'; DELETE FROM users WHERE '1'='1",
                    "'; UPDATE users SET role='admin' WHERE '1'='1"
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toBe(
                'SELECT "users"."*" FROM "users" WHERE "users"."name" BETWEEN ? AND ?;'
            );
        });
    });

    // ==========================================================================
    // SECTION 20: Consistency tests across dialects
    // ==========================================================================
    describe('Consistency across all dialects', () => {
        const allDialects = [
            { name: 'SQLite', dialect: sqliteDialect },
            { name: 'MySQL', dialect: mysqlDialect },
            { name: 'PostgreSQL', dialect: postgresDialect },
            { name: 'MSSQL', dialect: mssqlDialect }
        ];

        allDialects.forEach(({ name, dialect }) => {
            describe(`${name} dialect consistency`, () => {
                it('should produce same params for simple BETWEEN', () => {
                    const q = new SelectQueryBuilder(Users)
                        .selectRaw('*')
                        .where(between(Users.columns.id, 1, 100));
                    const compiled = q.compile(dialect);
                    expect(compiled.params).toEqual([1, 100]);
                });

                it('should produce same params for complex query', () => {
                    const q = new SelectQueryBuilder(Orders)
                        .selectRaw('*')
                        .where(between(Orders.columns.id, 1, 50))
                        .where(notBetween(Orders.columns.total, 0, 10))
                        .where(eq(Orders.columns.status, 'completed'));
                    const compiled = q.compile(dialect);
                    expect(compiled.params).toEqual([1, 50, 0, 10, 'completed']);
                });

                it('should contain BETWEEN keyword in SQL', () => {
                    const q = new SelectQueryBuilder(Users)
                        .selectRaw('*')
                        .where(between(Users.columns.id, 5, 15));
                    const compiled = q.compile(dialect);
                    expect(compiled.sql).toContain('BETWEEN');
                });

                it('should contain NOT BETWEEN keyword in SQL', () => {
                    const q = new SelectQueryBuilder(Users)
                        .selectRaw('*')
                        .where(notBetween(Users.columns.id, 5, 15));
                    const compiled = q.compile(dialect);
                    expect(compiled.sql).toContain('NOT BETWEEN');
                });
            });
        });
    });

    // ==========================================================================
    // SECTION 21: Date/DateTime BETWEEN tests
    // ==========================================================================
    describe('BETWEEN with Date values', () => {
        const EventsTable = defineTable('events', {
            id: col.primaryKey(col.int()),
            name: col.varchar(255),
            event_date: col.date(),
            created_at: col.datetime()
        });

        it('should handle Date objects as bounds', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, startDate.toISOString(), endDate.toISOString()));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('BETWEEN');
            expect(compiled.params[0]).toBe('2024-01-01T00:00:00.000Z');
            expect(compiled.params[1]).toBe('2024-12-31T00:00:00.000Z');
        });

        it('should handle ISO date strings as bounds', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, '2024-01-01', '2024-06-30'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-01-01', '2024-06-30']);
        });

        it('should handle datetime with time component', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.created_at, '2024-01-01 00:00:00', '2024-01-01 23:59:59'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-01-01 00:00:00', '2024-01-01 23:59:59']);
        });

        it('should handle NOT BETWEEN with date strings', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(notBetween(EventsTable.columns.event_date, '2024-06-01', '2024-08-31'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.sql).toContain('NOT BETWEEN');
            expect(compiled.params).toEqual(['2024-06-01', '2024-08-31']);
        });

        it('should handle date BETWEEN with additional conditions', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, '2024-01-01', '2024-12-31'))
                .where(like(EventsTable.columns.name, 'Conference%'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-01-01', '2024-12-31', 'Conference%']);
        });

        it('should handle date BETWEEN across all dialects', () => {
            const allDialects = [sqliteDialect, mysqlDialect, postgresDialect, mssqlDialect];
            for (const dialect of allDialects) {
                const q = new SelectQueryBuilder(EventsTable)
                    .selectRaw('*')
                    .where(between(EventsTable.columns.event_date, '2024-01-01', '2024-12-31'));
                const compiled = q.compile(dialect);
                expect(compiled.sql).toContain('BETWEEN');
                expect(compiled.params).toEqual(['2024-01-01', '2024-12-31']);
            }
        });

        it('should handle date range with OR conditions', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(or(
                    between(EventsTable.columns.event_date, '2024-01-01', '2024-03-31'),
                    between(EventsTable.columns.event_date, '2024-10-01', '2024-12-31')
                ));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-01-01', '2024-03-31', '2024-10-01', '2024-12-31']);
        });

        it('should handle timestamp with timezone format', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.created_at, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z']);
        });

        it('should handle year-only date range', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, '2020-01-01', '2029-12-31'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2020-01-01', '2029-12-31']);
        });

        it('should handle same day range (start of day to end of day)', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.created_at, '2024-06-15 00:00:00.000', '2024-06-15 23:59:59.999'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2024-06-15 00:00:00.000', '2024-06-15 23:59:59.999']);
        });

        it('should handle historic dates', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, '1900-01-01', '1999-12-31'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['1900-01-01', '1999-12-31']);
        });

        it('should handle future dates', () => {
            const q = new SelectQueryBuilder(EventsTable)
                .selectRaw('*')
                .where(between(EventsTable.columns.event_date, '2030-01-01', '2099-12-31'));
            const compiled = q.compile(sqliteDialect);
            expect(compiled.params).toEqual(['2030-01-01', '2099-12-31']);
        });
    });
});

// =============================================================================
// SECTION 22: E2E Tests with real SQL Server database (vw_afastamento_pessoa)
// =============================================================================
const hasEnv =
    !!process.env.PGE_DIGITAL_HOST &&
    !!process.env.PGE_DIGITAL_USER &&
    !!process.env.PGE_DIGITAL_PASSWORD;

const maybeE2E = hasEnv ? describe : describe.skip;

// Define the view schema based on vw_afastamento_pessoa
const VwAfastamentoPessoa = defineTable('vw_afastamento_pessoa', {
    id: col.int(),
    pessoa_id: col.int(),
    data_inicio: col.date(),
    data_fim: col.date(),
    tipo_afastamento: col.varchar(255),
    descricao: col.varchar(500)
});

maybeE2E('BETWEEN E2E with SQL Server (vw_afastamento_pessoa)', () => {
    let connection: Connection;
    let session: OrmSession;
    let orm: Orm;

    beforeAll(async () => {
        const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;

        connection = await new Promise<Connection>((resolve, reject) => {
            const conn = new Connection({
                server: PGE_DIGITAL_HOST!,
                authentication: {
                    type: 'default',
                    options: {
                        userName: PGE_DIGITAL_USER!,
                        password: PGE_DIGITAL_PASSWORD!,
                    },
                },
                options: {
                    database: 'PGE_DIGITAL',
                    encrypt: true,
                    trustServerCertificate: true,
                    connectTimeout: 15000,
                },
            });

            conn.on('connect', (err) => {
                if (err) reject(err);
                else resolve(conn);
            });

            conn.connect();
        });

        const executor = createTediousExecutor(connection, { Request, TYPES });
        orm = new Orm({
            dialect: new SqlServerDialect(),
            executorFactory: {
                createExecutor: () => executor,
                createTransactionalExecutor: () => executor,
                dispose: async () => { }
            }
        });
        session = new OrmSession({ orm, executor });
    });

    afterAll(() => {
        connection?.close();
    });

    it('should query with BETWEEN on data_inicio date column', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio', 'data_fim')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
            .limit(10);

        const compiled = query.compile(new SqlServerDialect());
        expect(compiled.sql).toContain('BETWEEN');
        expect(compiled.sql).toContain('[vw_afastamento_pessoa]');

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with BETWEEN on data_fim date column', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio', 'data_fim')
            .where(between(VwAfastamentoPessoa.columns.data_fim, '2020-01-01', '2025-12-31'))
            .limit(10);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with NOT BETWEEN on date columns', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio')
            .where(notBetween(VwAfastamentoPessoa.columns.data_inicio, '2000-01-01', '2010-12-31'))
            .limit(10);

        const compiled = query.compile(new SqlServerDialect());
        expect(compiled.sql).toContain('NOT BETWEEN');

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with BETWEEN on both data_inicio and data_fim', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio', 'data_fim')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2022-01-01', '2024-12-31'))
            .where(between(VwAfastamentoPessoa.columns.data_fim, '2022-01-01', '2025-12-31'))
            .limit(10);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with BETWEEN combined with eq condition', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
            .where(isNotNull(VwAfastamentoPessoa.columns.data_fim))
            .limit(10);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with OR between two date ranges', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio')
            .where(or(
                between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2020-12-31'),
                between(VwAfastamentoPessoa.columns.data_inicio, '2023-01-01', '2023-12-31')
            ))
            .limit(10);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should query with BETWEEN and ORDER BY', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
            .orderBy(VwAfastamentoPessoa.columns.data_inicio, 'DESC')
            .limit(5);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return correct row count with BETWEEN filter', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2023-01-01', '2023-12-31'))
            .limit(100);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
        // Verify results have the expected structure
        if (results.length > 0) {
            expect(results[0]).toHaveProperty('id');
        }
    });

    it('should handle current year date range', async () => {
        const currentYear = new Date().getFullYear();
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;

        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, startDate, endDate))
            .limit(10);

        const results = await query.execute(session);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should handle paged query with BETWEEN', async () => {
        const query = new SelectQueryBuilder(VwAfastamentoPessoa)
            .select('id', 'data_inicio', 'data_fim')
            .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'));

        const pagedResult = await query.executePaged(session, { page: 1, pageSize: 5 });
        expect(pagedResult).toHaveProperty('items');
        expect(pagedResult).toHaveProperty('totalItems');
        expect(pagedResult).toHaveProperty('page');
        expect(pagedResult).toHaveProperty('pageSize');
        expect(Array.isArray(pagedResult.items)).toBe(true);
        expect(pagedResult.items.length).toBeLessThanOrEqual(5);
    });
}, 60_000);
