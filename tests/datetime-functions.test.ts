import { describe, it, expect } from 'vitest';
import type { CompilerContext } from '../src/core/dialect/abstract.js';
import { Dialect } from '../src/core/dialect/abstract.js';
import type { DialectName } from '../src/core/sql/sql.js';
import {
    now, currentDate, currentTime, utcNow, extract, year, month, day,
    dateAdd, dateSub, dateDiff, dateFormat, unixTimestamp, fromUnixTime,
    endOfMonth, dayOfWeek, weekOfYear, dateTrunc
} from '../src/core/functions/datetime.js';
import {
    InMemoryFunctionRegistry,
    type FunctionRegistry
} from '../src/core/functions/function-registry.js';
import { registerDateTimeFunctions } from '../src/core/functions/datetime.js';
import type { FunctionNode } from '../src/core/ast/expression.js';
import type { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../src/core/ast/query.js';

class TestDialect extends Dialect {
    protected readonly dialect: DialectName;

    constructor(dialect: DialectName = 'postgres', registry?: FunctionRegistry) {
        super(registry);
        this.dialect = dialect;
    }

    quoteIdentifier(id: string): string {
        return `"${id}"`;
    }

    // Minimal implementations to satisfy abstract requirements (not used in tests)
    protected compileSelectAst(_ast: SelectQueryNode, _ctx: CompilerContext): string {
        return '';
    }
    protected compileInsertAst(_ast: InsertQueryNode, _ctx: CompilerContext): string {
        return '';
    }
    protected compileUpdateAst(_ast: UpdateQueryNode, _ctx: CompilerContext): string {
        return '';
    }
    protected compileDeleteAst(_ast: DeleteQueryNode, _ctx: CompilerContext): string {
        return '';
    }

    public compileFn(node: FunctionNode): string {
        const ctx = this.createCompilerContext();
        return this.compileFunctionOperand(node, ctx);
    }
}

describe('DateTime Functions', () => {
    describe('Helper functions generate correct nodes', () => {
        it('now() creates NOW function node', () => {
            const node = now();
            expect(node.type).toBe('Function');
            expect(node.name).toBe('NOW');
            expect(node.args).toHaveLength(0);
        });

        it('currentDate() creates CURRENT_DATE function node', () => {
            const node = currentDate();
            expect(node.type).toBe('Function');
            expect(node.name).toBe('CURRENT_DATE');
            expect(node.args).toHaveLength(0);
        });

        it('currentTime() creates CURRENT_TIME function node', () => {
            const node = currentTime();
            expect(node.type).toBe('Function');
            expect(node.name).toBe('CURRENT_TIME');
            expect(node.args).toHaveLength(0);
        });

        it('utcNow() creates UTC_NOW function node', () => {
            const node = utcNow();
            expect(node.type).toBe('Function');
            expect(node.name).toBe('UTC_NOW');
            expect(node.args).toHaveLength(0);
        });

        it('extract() accepts two arguments (part, date)', () => {
            const node = extract('YEAR', '2024-01-15');
            expect(node.args).toHaveLength(2);
        });

        it('year() accepts one argument', () => {
            const node = year('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('month() accepts one argument', () => {
            const node = month('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('day() accepts one argument', () => {
            const node = day('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('dateAdd() accepts three arguments (date, interval, unit)', () => {
            const node = dateAdd('2024-01-15', 7, 'day');
            expect(node.args).toHaveLength(3);
        });

        it('dateSub() accepts three arguments (date, interval, unit)', () => {
            const node = dateSub('2024-01-15', 7, 'day');
            expect(node.args).toHaveLength(3);
        });

        it('dateDiff() accepts two arguments', () => {
            const node = dateDiff('2024-01-15', '2024-01-01');
            expect(node.args).toHaveLength(2);
        });

        it('dateFormat() accepts two arguments', () => {
            const node = dateFormat('2024-01-15', '%Y-%m-%d');
            expect(node.args).toHaveLength(2);
        });

        it('unixTimestamp() creates zero-argument function node', () => {
            const node = unixTimestamp();
            expect(node.args).toHaveLength(0);
        });

        it('fromUnixTime() accepts one argument', () => {
            const node = fromUnixTime(1704067200);
            expect(node.args).toHaveLength(1);
        });

        it('endOfMonth() accepts one argument', () => {
            const node = endOfMonth('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('dayOfWeek() accepts one argument', () => {
            const node = dayOfWeek('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('weekOfYear() accepts one argument', () => {
            const node = weekOfYear('2024-01-15');
            expect(node.args).toHaveLength(1);
        });

        it('dateTrunc() accepts two arguments (part, date)', () => {
            const node = dateTrunc('month', '2024-01-15');
            expect(node.args).toHaveLength(2);
        });
    });

    describe('Registry and rendering', () => {
        it('registers all datetime functions', () => {
            const registry = new InMemoryFunctionRegistry();
            registerDateTimeFunctions(registry);

            const functions = [
                'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'UTC_NOW', 'EXTRACT',
                'YEAR', 'MONTH', 'DAY', 'DATE_ADD', 'DATE_SUB', 'DATE_DIFF',
                'DATE_FORMAT', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME', 'END_OF_MONTH',
                'DAY_OF_WEEK', 'WEEK_OF_YEAR', 'DATE_TRUNC'
            ];

            functions.forEach(fn => {
                expect(registry.isRegistered(fn)).toBe(true);
            });
        });
    });

    describe('Dialect-specific rendering', () => {
        describe('NOW variants', () => {
            it('SQLite uses datetime function', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(now())).toBe("datetime('now', 'localtime')");
            });

            it('PostgreSQL uses NOW()', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(now())).toBe('NOW()');
            });

            it('MySQL uses NOW()', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(now())).toBe('NOW()');
            });

            it('MSSQL uses GETDATE()', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(now())).toBe('GETDATE()');
            });
        });

        describe('CURRENT_DATE variants', () => {
            it('SQLite uses date function', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(currentDate())).toBe("date('now', 'localtime')");
            });

            it('PostgreSQL uses CURRENT_DATE', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(currentDate())).toBe('CURRENT_DATE()');
            });

            it('MySQL uses CURDATE()', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(currentDate())).toBe('CURDATE()');
            });

            it('MSSQL uses CAST(GETDATE() AS DATE)', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(currentDate())).toBe('CAST(GETDATE() AS DATE)');
            });
        });

        describe('UTC_NOW variants', () => {
            it('SQLite uses datetime function without localtime', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(utcNow())).toBe("datetime('now')");
            });

            it('PostgreSQL uses NOW() AT TIME ZONE', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(utcNow())).toBe("(NOW() AT TIME ZONE 'UTC')");
            });

            it('MySQL uses UTC_TIMESTAMP()', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(utcNow())).toBe('UTC_TIMESTAMP()');
            });

            it('MSSQL uses GETUTCDATE()', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(utcNow())).toBe('GETUTCDATE()');
            });
        });

        describe('YEAR/MONTH/DAY variants', () => {
            it('SQLite uses strftime', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(year('2024-01-15'))).toBe("CAST(strftime('%Y', ?) AS INTEGER)");
                expect(dialect.compileFn(month('2024-01-15'))).toBe("CAST(strftime('%m', ?) AS INTEGER)");
                expect(dialect.compileFn(day('2024-01-15'))).toBe("CAST(strftime('%d', ?) AS INTEGER)");
            });

            it('PostgreSQL uses EXTRACT', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(year('2024-01-15'))).toBe('EXTRACT(YEAR FROM ?)');
                expect(dialect.compileFn(month('2024-01-15'))).toBe('EXTRACT(MONTH FROM ?)');
                expect(dialect.compileFn(day('2024-01-15'))).toBe('EXTRACT(DAY FROM ?)');
            });

            it('MySQL uses YEAR/MONTH/DAY functions', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(year('2024-01-15'))).toBe('YEAR(?)');
                expect(dialect.compileFn(month('2024-01-15'))).toBe('MONTH(?)');
                expect(dialect.compileFn(day('2024-01-15'))).toBe('DAY(?)');
            });

            it('MSSQL uses YEAR/MONTH/DAY functions', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(year('2024-01-15'))).toBe('YEAR(?)');
                expect(dialect.compileFn(month('2024-01-15'))).toBe('MONTH(?)');
                expect(dialect.compileFn(day('2024-01-15'))).toBe('DAY(?)');
            });
        });

        describe('DATE_ADD variants', () => {
            it('SQLite uses datetime with modifier', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(dateAdd('2024-01-15', 7, 'day'))).toBe(
                    "datetime(?, '+' || ? || ' day')"
                );
            });

            it('PostgreSQL uses interval arithmetic', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(dateAdd('2024-01-15', 7, 'day'))).toBe(
                    "(? + (? || ' day')::INTERVAL)"
                );
            });

            it('MySQL uses DATE_ADD function', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(dateAdd('2024-01-15', 7, 'day'))).toBe(
                    'DATE_ADD(?, INTERVAL ? DAY)'
                );
            });

            it('MSSQL uses DATEADD function', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(dateAdd('2024-01-15', 7, 'day'))).toBe(
                    'DATEADD(day, ?, ?)'
                );
            });
        });

        describe('DATE_DIFF variants', () => {
            it('SQLite uses julianday difference', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(dateDiff('2024-01-15', '2024-01-01'))).toBe(
                    'CAST(julianday(?) - julianday(?) AS INTEGER)'
                );
            });

            it('PostgreSQL uses date subtraction', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(dateDiff('2024-01-15', '2024-01-01'))).toBe(
                    '(?::DATE - ?::DATE)'
                );
            });

            it('MySQL uses DATEDIFF function', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(dateDiff('2024-01-15', '2024-01-01'))).toBe(
                    'DATEDIFF(?, ?)'
                );
            });

            it('MSSQL uses DATEDIFF with day unit', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(dateDiff('2024-01-15', '2024-01-01'))).toBe(
                    'DATEDIFF(day, ?, ?)'
                );
            });
        });

        describe('END_OF_MONTH variants', () => {
            it('SQLite uses date with modifiers', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(endOfMonth('2024-01-15'))).toBe(
                    "date(?, 'start of month', '+1 month', '-1 day')"
                );
            });

            it('PostgreSQL uses date_trunc expression', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(endOfMonth('2024-01-15'))).toBe(
                    "(date_trunc('month', ?) + interval '1 month' - interval '1 day')::DATE"
                );
            });

            it('MySQL uses LAST_DAY', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(endOfMonth('2024-01-15'))).toBe('LAST_DAY(?)');
            });

            it('MSSQL uses EOMONTH', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(endOfMonth('2024-01-15'))).toBe('EOMONTH(?)');
            });
        });

        describe('UNIX_TIMESTAMP variants', () => {
            it('SQLite uses strftime', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(unixTimestamp())).toBe("CAST(strftime('%s', 'now') AS INTEGER)");
            });

            it('PostgreSQL uses EXTRACT EPOCH', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(unixTimestamp())).toBe('EXTRACT(EPOCH FROM NOW())::INTEGER');
            });

            it('MySQL uses UNIX_TIMESTAMP()', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(unixTimestamp())).toBe('UNIX_TIMESTAMP()');
            });

            it('MSSQL uses DATEDIFF from epoch', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(unixTimestamp())).toBe("DATEDIFF(SECOND, '1970-01-01', GETUTCDATE())");
            });
        });

        describe('FROM_UNIXTIME variants', () => {
            it('SQLite uses datetime with unixepoch', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(fromUnixTime(1704067200))).toBe("datetime(?, 'unixepoch')");
            });

            it('PostgreSQL uses to_timestamp', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(fromUnixTime(1704067200))).toBe('to_timestamp(?)');
            });

            it('MySQL uses FROM_UNIXTIME', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(fromUnixTime(1704067200))).toBe('FROM_UNIXTIME(?)');
            });

            it('MSSQL uses DATEADD from epoch', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(fromUnixTime(1704067200))).toBe("DATEADD(SECOND, ?, '1970-01-01')");
            });
        });

        describe('DATE_FORMAT variants', () => {
            it('SQLite uses strftime', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(dateFormat('2024-01-15', '%Y-%m-%d'))).toBe('strftime(?, ?)');
            });

            it('PostgreSQL uses TO_CHAR', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(dateFormat('2024-01-15', 'YYYY-MM-DD'))).toBe('TO_CHAR(?, ?)');
            });

            it('MySQL uses DATE_FORMAT', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(dateFormat('2024-01-15', '%Y-%m-%d'))).toBe('DATE_FORMAT(?, ?)');
            });

            it('MSSQL uses FORMAT', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(dateFormat('2024-01-15', 'yyyy-MM-dd'))).toBe('FORMAT(?, ?)');
            });
        });

        describe('DATE_TRUNC variants', () => {
            it('SQLite uses date with start of modifier', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(dateTrunc('month', '2024-01-15'))).toBe("date(?, 'start of month')");
            });

            it('PostgreSQL uses DATE_TRUNC', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(dateTrunc('month', '2024-01-15'))).toBe("DATE_TRUNC('month', ?)");
            });

            it('MySQL uses DATE_FORMAT workaround', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(dateTrunc('month', '2024-01-15'))).toBe("DATE_FORMAT(?, '%Y-%m-01')");
            });

            it('MSSQL uses DATETRUNC', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(dateTrunc('month', '2024-01-15'))).toBe('DATETRUNC(month, ?)');
            });
        });
    });

    describe('Integration with columns', () => {
        it('accepts column definitions as arguments', () => {
            const dialect = new TestDialect('postgres');
            const col = { name: 'created_at', type: 'TIMESTAMP', table: 'orders' } as const;

            expect(dialect.compileFn(year(col))).toBe('EXTRACT(YEAR FROM "orders"."created_at")');
            expect(dialect.compileFn(month(col))).toBe('EXTRACT(MONTH FROM "orders"."created_at")');
            expect(dialect.compileFn(day(col))).toBe('EXTRACT(DAY FROM "orders"."created_at")');
        });
    });
});
