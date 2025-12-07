import { describe, it, expect } from 'vitest';
import {
    SelectQueryBuilder,
} from '../src/query-builder/select.js'; // Adjust path as needed
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column.js';
import { PostgresDialect } from '../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../src/core/dialect/mssql/index.js';

// Import Function Builders
import { now, currentDate, currentTime, year, month, day, dateAdd, dateSub, dateDiff, dateFormat, unixTimestamp, fromUnixTime, endOfMonth, dayOfWeek, weekOfYear, dateTrunc } from '../src/core/functions/datetime.js';

// 1. Setup a Dummy Table for context
const userTable = defineTable('users', {
    id: col.int(),
    createdAt: col.datetime(),
    updatedAt: col.timestamp(),
    birthDate: col.date()
});

// 2. Helper to compile and extract SQL
const getSql = (dialect: any, builder: any) => {
    return builder.compile(dialect).sql;
};

describe('DateTime Function Dialect Strategies', () => {
    // Instantiate dialects once
    const postgres = new PostgresDialect();
    const mysql = new MySqlDialect();
    const sqlite = new SqliteDialect();
    const mssql = new SqlServerDialect(); // Ensure class name matches your export

    describe('DateTime Functions', () => {
        it('renders NOW function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                nowTime: now()
            });

            expect(getSql(postgres, qb)).toContain('NOW()');
            expect(getSql(mysql, qb)).toContain('NOW()');
            expect(getSql(mssql, qb)).toContain('GETDATE()'); // MSSQL uses GETDATE() instead of NOW()
            expect(getSql(sqlite, qb)).toContain('datetime('); // SQLite uses datetime('now')
        });

        it('renders CURRENT_DATE function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                currentDate: currentDate()
            });

            expect(getSql(postgres, qb)).toContain('CURRENT_DATE');
            expect(getSql(mysql, qb)).toContain('CURDATE()'); // MySQL uses CURDATE() instead of CURRENT_DATE
            expect(getSql(mssql, qb)).toContain('GETDATE()'); // MSSQL uses GETDATE()
            expect(getSql(sqlite, qb)).toContain('date('); // SQLite uses date('now')
        });

        it('renders CURRENT_TIME function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                currentTime: currentTime()
            });

            expect(getSql(postgres, qb)).toContain('CURRENT_TIME');
            expect(getSql(mysql, qb)).toContain('CURTIME()'); // MySQL uses CURTIME() instead of CURRENT_TIME
            expect(getSql(mssql, qb)).toContain('GETDATE()'); // MSSQL uses GETDATE() for current time
            expect(getSql(sqlite, qb)).toContain('time('); // SQLite uses time('now')
        });

        it('renders YEAR function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                yearCreated: year(userTable.columns.createdAt)
            });

            // Postgres: EXTRACT(YEAR FROM col) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('EXTRACT(YEAR FROM "users".');
            // MySQL: YEAR(col)
            expect(getSql(mysql, qb)).toContain('YEAR(`users`.');
            // MSSQL: YEAR(col)
            expect(getSql(mssql, qb)).toContain('YEAR([users].');
            // SQLite: CAST(strftime('%Y', col) AS INTEGER)
            expect(getSql(sqlite, qb)).toContain('strftime(\'%Y\', "users".');
        });

        it('renders MONTH function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                monthCreated: month(userTable.columns.createdAt)
            });

            // Postgres: EXTRACT(MONTH FROM col) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('EXTRACT(MONTH FROM "users".');
            // MySQL: MONTH(col)
            expect(getSql(mysql, qb)).toContain('MONTH(`users`.');
            // MSSQL: MONTH(col)
            expect(getSql(mssql, qb)).toContain('MONTH([users].');
            // SQLite: CAST(strftime('%m', col) AS INTEGER)
            expect(getSql(sqlite, qb)).toContain('strftime(\'%m\', "users".');
        });

        it('renders DAY function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                dayCreated: day(userTable.columns.createdAt)
            });

            // Postgres: EXTRACT(DAY FROM col) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('EXTRACT(DAY FROM "users".');
            // MySQL: DAY(col)
            expect(getSql(mysql, qb)).toContain('DAY(`users`.');
            // MSSQL: DAY(col)
            expect(getSql(mssql, qb)).toContain('DAY([users].');
            // SQLite: CAST(strftime('%d', col) AS INTEGER)
            expect(getSql(sqlite, qb)).toContain('strftime(\'%d\', "users".');
        });

        it('renders DATE_ADD function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                nextWeek: dateAdd(userTable.columns.createdAt, 7, 'DAY')
            });

            // Postgres: (col + (interval || ' ' || unit)::INTERVAL) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('("users".');
            // MySQL: DATE_ADD(col, INTERVAL val unit)
            expect(getSql(mysql, qb)).toContain('DATE_ADD(`users`.');
            // MSSQL: DATEADD(unit, val, col) - parameter might be used instead of literal
            expect(getSql(mssql, qb)).toContain('DATEADD(day, ');
            // SQLite: datetime(col, '+' || val || ' unit')
            expect(getSql(sqlite, qb)).toContain('datetime("users".');
        });

        it('renders DATE_SUB function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                lastWeek: dateSub(userTable.columns.createdAt, 7, 'DAY')
            });

            // Postgres: (col - (interval || ' ' || unit)::INTERVAL) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('("users".');
            // MySQL: DATE_SUB(col, INTERVAL val unit)
            expect(getSql(mysql, qb)).toContain('DATE_SUB(`users`.');
            // MSSQL: DATEADD(unit, -val, col) - parameter might be used instead of literal
            expect(getSql(mssql, qb)).toContain('DATEADD(day, ');
            // SQLite: datetime(col, '-' || val || ' unit')
            expect(getSql(sqlite, qb)).toContain('datetime("users".');
        });

        it('renders DATE_DIFF function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                dateDiff: dateDiff(userTable.columns.createdAt, userTable.columns.updatedAt)
            });

            // Postgres: (date1::DATE - date2::DATE) - column names might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('("users".');
            // MySQL: DATEDIFF(date1, date2)
            expect(getSql(mysql, qb)).toContain('DATEDIFF(`users`.');
            // MSSQL: DATEDIFF(day, date2, date1)
            expect(getSql(mssql, qb)).toContain('DATEDIFF(day, [users].');
            // SQLite: CAST(julianday(date1) - julianday(date2) AS INTEGER)
            expect(getSql(sqlite, qb)).toContain('julianday("users".');
        });

        it('renders DATE_FORMAT function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                formattedDate: dateFormat(userTable.columns.createdAt, '%Y-%m-%d')
            });

            // Postgres: TO_CHAR(date, format) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('TO_CHAR("users".');
            // MySQL: DATE_FORMAT(date, format)
            expect(getSql(mysql, qb)).toContain('DATE_FORMAT(`users`.');
            // MSSQL: FORMAT(date, format) - if available
            // SQLite: strftime(format, date) - format might be parameterized
            expect(getSql(sqlite, qb)).toContain('strftime(');
        });

        it('renders UNIX_TIMESTAMP function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                unixTime: unixTimestamp()
            });

            // Postgres: EXTRACT(EPOCH FROM NOW())::INTEGER
            expect(getSql(postgres, qb)).toContain('EXTRACT(EPOCH FROM NOW())');
            // MySQL: UNIX_TIMESTAMP()
            expect(getSql(mysql, qb)).toContain('UNIX_TIMESTAMP()');
            // MSSQL: Not directly available
            // SQLite: strftime('%s', 'now')
        });

        it('renders FROM_UNIXTIME function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                fromUnix: fromUnixTime(1672531200)
            });

            // Postgres: to_timestamp(value) - value might be parameterized
            expect(getSql(postgres, qb)).toContain('to_timestamp(');
            // MySQL: FROM_UNIXTIME(value)
            expect(getSql(mysql, qb)).toContain('FROM_UNIXTIME(');
            // MSSQL: DATEADD(s, value, '1970-01-01')
            // SQLite: datetime(value, 'unixepoch')
        });

        it('renders DAY_OF_WEEK function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                dayOfWeek: dayOfWeek(userTable.columns.createdAt)
            });

            // Postgres: EXTRACT(DOW FROM date) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('EXTRACT(DOW FROM "users".');
            // MySQL: DAYOFWEEK(date) - column name might be converted to snake_case
            expect(getSql(mysql, qb)).toContain('DAYOFWEEK(`users`.');
            // MSSQL: DATEPART(dw, date) - column name might be converted to snake_case
            expect(getSql(mssql, qb)).toContain('DATEPART(dw, [users].');
            // SQLite: strftime('%w', date) - column name might be converted to snake_case
            expect(getSql(sqlite, qb)).toContain('strftime(\'%w\', "users".');
        });

        it('renders WEEK_OF_YEAR function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                weekOfYear: weekOfYear(userTable.columns.createdAt)
            });

            // Postgres: EXTRACT(WEEK FROM date) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('EXTRACT(WEEK FROM "users".');
            // MySQL: WEEKOFYEAR(date) - column name might be converted to snake_case
            expect(getSql(mysql, qb)).toContain('WEEKOFYEAR(`users`.');
            // MSSQL: DATEPART(week, date) - may use 'wk' abbreviation - column name might be converted to snake_case
            const mssqlSql = getSql(mssql, qb);
            expect(mssqlSql).toMatch(/DATEPART\((wk|week), \[users\]\./); // MSSQL may abbreviate week as wk or use full word
            // SQLite: strftime('%W', date) - column name might be converted to snake_case
            expect(getSql(sqlite, qb)).toContain('strftime(\'%W\', "users".');
        });

        it('renders DATE_TRUNC function correctly across dialects', () => {
            const qb = new SelectQueryBuilder(userTable).select({
                truncatedDate: dateTrunc('MONTH', userTable.columns.createdAt)
            });

            // Postgres: DATE_TRUNC('month', date) - column name might be converted to snake_case
            expect(getSql(postgres, qb)).toContain('DATE_TRUNC(\'month\', "users".');
            // MySQL: DATE_FORMAT with pattern
            expect(getSql(mysql, qb)).toContain('DATE_FORMAT(`users`.');
            // MSSQL: Convert to beginning of month - may use DATETRUNC or DATEFROMPARTS
            expect(getSql(mssql, qb)).toMatch(/(DATETRUNC|DATEFROMPARTS)/);
            // SQLite: DATE with pattern - column name might be converted to snake_case
        });
    });
});
