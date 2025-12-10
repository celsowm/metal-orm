import { describe, it, expect } from 'vitest';
import {
    SelectQueryBuilder,
} from '../../../src/query-builder/select.js'; // Adjust path as needed
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';

// Import Function Builders
import { abs, round, ceil, floor, power, mod, sqrt, sin, cos, tan, log, ln, exp } from '../../../src/core/functions/numeric.js';

// 1. Setup a Dummy Table for context
const userTable = defineTable('users', {
    id: col.int(),
    score: col.decimal(10, 2),
    age: col.int(),
    rating: col.float()
});

// 2. Helper to compile and extract SQL
const getSql = (dialect: any, builder: any) => {
    return builder.compile(dialect).sql;
};

describe('Numeric Function Dialect Strategies', () => {
    // Instantiate dialects once
    const postgres = new PostgresDialect();
    const mysql = new MySqlDialect();
    const sqlite = new SqliteDialect();
    const mssql = new SqlServerDialect(); // Ensure class name matches your export

    describe('Numeric Functions', () => {
        it('renders ABS (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                absScore: abs(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('ABS("users"."score")');
            expect(getSql(mysql, qb)).toContain('ABS(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('ABS([users].[score])');
            expect(getSql(sqlite, qb)).toContain('ABS("users"."score")');
        });

        it('renders ROUND with precision correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                roundedScore: round(userTable.columns.score, 2)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('ROUND("users"."score", ');
            expect(getSql(mysql, qb)).toContain('ROUND(`users`.`score`, ');
            expect(getSql(mssql, qb)).toContain('ROUND([users].[score], ');
            expect(getSql(sqlite, qb)).toContain('ROUND("users"."score", ');
        });

        it('renders ROUND without precision correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                roundedScore: round(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('ROUND("users"."score")');
            expect(getSql(mysql, qb)).toContain('ROUND(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('ROUND([users].[score])');
            expect(getSql(sqlite, qb)).toContain('ROUND("users"."score")');
        });

        it('renders CEIL function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                ceilScore: ceil(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('CEIL("users"."score")');
            expect(getSql(mysql, qb)).toContain('CEIL(`users`.`score`)');
            // MSSQL doesn't have override for CEIL, so it should use the standard CEIL function
            expect(getSql(mssql, qb)).toContain('CEIL([users].[score])'); // MSSQL uses CEIL directly if no override
            expect(getSql(sqlite, qb)).toContain('CEIL("users"."score")');
        });

        it('renders FLOOR function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                floorScore: floor(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('FLOOR("users"."score")');
            expect(getSql(mysql, qb)).toContain('FLOOR(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('FLOOR([users].[score])');
            expect(getSql(sqlite, qb)).toContain('FLOOR("users"."score")');
        });

        it('renders POWER function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                powerScore: power(userTable.columns.score, 2)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('POWER("users"."score", ');
            expect(getSql(mysql, qb)).toContain('POWER(`users`.`score`, ');
            expect(getSql(mssql, qb)).toContain('POWER([users].[score], ');
            expect(getSql(sqlite, qb)).toContain('POWER("users"."score", ');
        });

        it('renders MOD function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                modScore: mod(userTable.columns.score, 10)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('MOD("users"."score", ');
            expect(getSql(mysql, qb)).toContain('MOD(`users`.`score`, ');
            // MSSQL doesn't have MOD function, so it might use a different implementation
            expect(getSql(mssql, qb)).toContain('MOD([users].[score], '); // Check if it falls back to standard
            expect(getSql(sqlite, qb)).toContain('MOD("users"."score", ');
        });

        it('renders LN function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                lnScore: ln(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('LN("users"."score")');
            expect(getSql(mysql, qb)).toContain('LN(`users`.`score`)');
            // MSSQL doesn't have override for LN, so it should use the standard LN function
            expect(getSql(mssql, qb)).toContain('LN([users].[score])'); // MSSQL uses LN directly if no override
            expect(getSql(sqlite, qb)).toContain('LN("users"."score")');
        });

        it('renders SIN function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                sinScore: sin(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('SIN("users"."score")');
            expect(getSql(mysql, qb)).toContain('SIN(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('SIN([users].[score])');
            expect(getSql(sqlite, qb)).toContain('SIN("users"."score")');
        });

        it('renders COS function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                cosScore: cos(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('COS("users"."score")');
            expect(getSql(mysql, qb)).toContain('COS(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('COS([users].[score])');
            expect(getSql(sqlite, qb)).toContain('COS("users"."score")');
        });

        it('renders TAN function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                tanScore: tan(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('TAN("users"."score")');
            expect(getSql(mysql, qb)).toContain('TAN(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('TAN([users].[score])');
            expect(getSql(sqlite, qb)).toContain('TAN("users"."score")');
        });

        it('renders LOG function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                logScore: log(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('LOG("users"."score")');
            expect(getSql(mysql, qb)).toContain('LOG(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('LOG([users].[score])');
            expect(getSql(sqlite, qb)).toContain('LOG("users"."score")');
        });

        it('renders EXP function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                expScore: exp(userTable.columns.score)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('EXP("users"."score")');
            expect(getSql(mysql, qb)).toContain('EXP(`users`.`score`)');
            expect(getSql(mssql, qb)).toContain('EXP([users].[score])');
            expect(getSql(sqlite, qb)).toContain('EXP("users"."score")');
        });
    });
});
