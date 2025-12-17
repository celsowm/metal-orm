import { describe, it, expect } from 'vitest';
import {
    SelectQueryBuilder,
} from '../../../src/query-builder/select.js'; // Adjust path as needed
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';

// Import Function Builders
import { lower, concat, upper, trim, ltrim, rtrim, left, right, substr, length, replace, charLength } from '../../../src/core/functions/text.js';
import { groupConcat } from '../../../src/core/ast/aggregate-functions.js';

// 1. Setup a Dummy Table for context
const userTable = defineTable('users', {
    id: col.int(),
    name: col.varchar(255),
    description: col.varchar(100), // Use varchar instead of text
    email: col.varchar(255)
});

// 2. Helper to compile and extract SQL
const getSql = (dialect: any, builder: any) => {
    return builder.compile(dialect).sql;
};

describe('Text Function Dialect Strategies', () => {
    // Instantiate dialects once
    const postgres = new PostgresDialect();
    const mysql = new MySqlDialect();
    const sqlite = new SqliteDialect();
    const mssql = new SqlServerDialect(); // Ensure class name matches your export

    describe('Text Functions', () => {
        it('renders LOWER (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                lowerName: lower(userTable.columns.name)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('LOWER("users"."name")');
            expect(getSql(mysql, qb)).toContain('LOWER(`users`.`name`)');
            expect(getSql(mssql, qb)).toContain('LOWER([users].[name])');
            expect(getSql(sqlite, qb)).toContain('LOWER("users"."name")');
        });

        it('renders UPPER (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                upperName: upper(userTable.columns.name)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('UPPER("users"."name")');
            expect(getSql(mysql, qb)).toContain('UPPER(`users`.`name`)');
            expect(getSql(mssql, qb)).toContain('UPPER([users].[name])');
            expect(getSql(sqlite, qb)).toContain('UPPER("users"."name")');
        });

        it('renders TRIM (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                trimmedName: trim(userTable.columns.name)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('TRIM("users"."name")');
            expect(getSql(mysql, qb)).toContain('TRIM(`users`.`name`)');
            expect(getSql(mssql, qb)).toContain('TRIM([users].[name])');
            expect(getSql(sqlite, qb)).toContain('TRIM("users"."name")');
        });

        it('renders LTRIM (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                ltrimmedName: ltrim(userTable.columns.name)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('LTRIM("users"."name")');
            expect(getSql(mysql, qb)).toContain('LTRIM(`users`.`name`)');
            expect(getSql(mssql, qb)).toContain('LTRIM([users].[name])');
            expect(getSql(sqlite, qb)).toContain('LTRIM("users"."name")');
        });

        it('renders RTRIM (Standard SQL) consistently', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                rtrimmedName: rtrim(userTable.columns.name)
            });

            // Standard behavior expected across all
            expect(getSql(postgres, qb)).toContain('RTRIM("users"."name")');
            expect(getSql(mysql, qb)).toContain('RTRIM(`users`.`name`)');
            expect(getSql(mssql, qb)).toContain('RTRIM([users].[name])');
            expect(getSql(sqlite, qb)).toContain('RTRIM("users"."name")');
        });

        it('renders CONCAT (Standard vs Dialect specifics)', () => {
            // Note: In your StandardStrategy, CONCAT is defined as CONCAT(arg1, arg2)
            // SQLite technically uses ||, but since we didn't add an override in the 
            // provided SqliteFunctionStrategy source, it should fallback to Standard CONCAT.
            // This test verifies the Strategy inheritance.

            const qb = new SelectQueryBuilder(userTable).select({
                fullName: concat(userTable.columns.name, userTable.columns.email)
            });

            expect(getSql(postgres, qb)).toContain(`CONCAT("users"."name", "users"."email")`);
            expect(getSql(mysql, qb)).toContain(`CONCAT(\`users\`.\`name\`, \`users\`.\`email\`)`);
            expect(getSql(mssql, qb)).toContain(`CONCAT([users].[name], [users].[email])`);
            expect(getSql(sqlite, qb)).toContain(`CONCAT("users"."name", "users"."email")`);
        });

        it('renders LEFT function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                leftName: left(userTable.columns.name, 5)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('LEFT("users"."name", ');
            expect(getSql(mysql, qb)).toContain('LEFT(`users`.`name`, ');
            expect(getSql(mssql, qb)).toContain('LEFT([users].[name], ');
            expect(getSql(sqlite, qb)).toContain('LEFT("users"."name", ');
        });

        it('renders RIGHT function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                rightName: right(userTable.columns.name, 5)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('RIGHT("users"."name", ');
            expect(getSql(mysql, qb)).toContain('RIGHT(`users`.`name`, ');
            expect(getSql(mssql, qb)).toContain('RIGHT([users].[name], ');
            expect(getSql(sqlite, qb)).toContain('RIGHT("users"."name", ');
        });

        it('renders SUBSTR function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                subName: substr(userTable.columns.name, 1, 5)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('SUBSTR("users"."name", ');
            expect(getSql(mysql, qb)).toContain('SUBSTR(`users`.`name`, ');
            expect(getSql(mssql, qb)).toContain('SUBSTR([users].[name], ');
            expect(getSql(sqlite, qb)).toContain('SUBSTR("users"."name", ');
        });

        it('renders LENGTH function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                nameLength: length(userTable.columns.name)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('LENGTH("users"."name")');
            expect(getSql(mysql, qb)).toContain('LENGTH(`users`.`name`)');
            // MSSQL doesn't have override for LENGTH, so it should use the standard LENGTH function
            expect(getSql(mssql, qb)).toContain('LENGTH([users].[name])'); // MSSQL uses LENGTH directly if no override
            expect(getSql(sqlite, qb)).toContain('LENGTH("users"."name")');
        });

        it('renders CHAR_LENGTH function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                charLength: charLength(userTable.columns.name)
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('CHAR_LENGTH("users"."name")');
            expect(getSql(mysql, qb)).toContain('CHAR_LENGTH(`users`.`name`)');
            // MSSQL doesn't have override for CHAR_LENGTH, so it should use the standard CHAR_LENGTH function
            expect(getSql(mssql, qb)).toContain('CHAR_LENGTH([users].[name])'); // MSSQL uses CHAR_LENGTH directly if no override
            expect(getSql(sqlite, qb)).toContain('CHAR_LENGTH("users"."name")');
        });

        it('renders REPLACE function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                replacedName: replace(userTable.columns.name, 'old', 'new')
            });

            // Standard behavior expected across all - parameters may be converted to ? placeholders
            expect(getSql(postgres, qb)).toContain('REPLACE("users"."name", ');
            expect(getSql(mysql, qb)).toContain('REPLACE(`users`.`name`, ');
            expect(getSql(mssql, qb)).toContain('REPLACE([users].[name], ');
            expect(getSql(sqlite, qb)).toContain('REPLACE("users"."name", ');
        });

        it('renders GROUP_CONCAT/STRING_AGG per dialect', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                names: groupConcat(userTable.columns.name, {
                    separator: '; ',
                    orderBy: [{ column: userTable.columns.name, direction: 'DESC' }]
                })
            });

            expect(getSql(postgres, qb)).toContain('STRING_AGG("users"."name"');
            expect(getSql(postgres, qb)).toContain('ORDER BY "users"."name" DESC');
            expect(getSql(mysql, qb)).toContain('GROUP_CONCAT(`users`.`name`');
            expect(getSql(mysql, qb)).toContain('ORDER BY `users`.`name` DESC');
            expect(getSql(mssql, qb)).toContain('STRING_AGG([users].[name]');
            expect(getSql(mssql, qb)).toContain('WITHIN GROUP');
            expect(getSql(sqlite, qb)).toContain('GROUP_CONCAT("users"."name"');
        });
    });
});


