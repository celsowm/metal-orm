import { describe, it, expect } from 'vitest';
import type { CompilerContext } from '../src/core/dialect/abstract.js';
import { Dialect } from '../src/core/dialect/abstract.js';
import type { DialectName } from '../src/core/sql/sql.js';
import {
    abs, acos, asin, atan, atan2, ceil, ceiling, cos, cot, degrees,
    exp, floor, ln, log, log10, logBase, mod, pi, power, pow, radians,
    random, rand, round, sign, sin, sqrt, tan, trunc, truncate
} from '../src/core/functions/numeric.js';
import {
    InMemoryFunctionRegistry,
    type FunctionRegistry
} from '../src/core/functions/function-registry.js';
import { registerNumericFunctions } from '../src/core/functions/numeric.js';
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

describe('Numeric Functions', () => {
    describe('Helper functions generate correct nodes', () => {
        it('abs() creates ABS function node', () => {
            const node = abs(5);
            expect(node.type).toBe('Function');
            expect(node.name).toBe('ABS');
        });

        it('round() handles optional decimals parameter', () => {
            const node1 = round(3.14159);
            expect(node1.args).toHaveLength(1);

            const node2 = round(3.14159, 2);
            expect(node2.args).toHaveLength(2);
        });

        it('trunc() handles optional decimals parameter', () => {
            const node1 = trunc(3.14159);
            expect(node1.args).toHaveLength(1);

            const node2 = trunc(3.14159, 2);
            expect(node2.args).toHaveLength(2);
        });

        it('pi() creates zero-argument function node', () => {
            const node = pi();
            expect(node.args).toHaveLength(0);
        });

        it('random() creates zero-argument function node', () => {
            const node = random();
            expect(node.args).toHaveLength(0);
        });

        it('atan2() accepts two arguments', () => {
            const node = atan2(1, 1);
            expect(node.args).toHaveLength(2);
        });

        it('logBase() accepts two arguments (base, value)', () => {
            const node = logBase(10, 100);
            expect(node.args).toHaveLength(2);
        });
    });

    describe('Registry and rendering', () => {
        it('registers all numeric functions', () => {
            const registry = new InMemoryFunctionRegistry();
            registerNumericFunctions(registry);

            const functions = [
                'ABS', 'ACOS', 'ASIN', 'ATAN', 'ATAN2', 'CEIL', 'CEILING',
                'COS', 'COT', 'DEGREES', 'EXP', 'FLOOR', 'LN', 'LOG', 'LOG10',
                'LOG_BASE', 'MOD', 'PI', 'POWER', 'POW', 'RADIANS', 'RANDOM',
                'RAND', 'ROUND', 'SIGN', 'SIN', 'SQRT', 'TAN', 'TRUNC', 'TRUNCATE'
            ];

            functions.forEach(fn => {
                expect(registry.isRegistered(fn)).toBe(true);
            });
        });

        it('renders basic functions universally', () => {
            const dialect = new TestDialect('postgres');
            expect(dialect.compileFn(abs(-5))).toBe('ABS(?)');
            expect(dialect.compileFn(floor(3.7))).toBe('FLOOR(?)');
            expect(dialect.compileFn(sqrt(16))).toBe('SQRT(?)');
            expect(dialect.compileFn(sin(1.5))).toBe('SIN(?)');
            expect(dialect.compileFn(cos(1.5))).toBe('COS(?)');
        });
    });

    describe('Dialect-specific rendering', () => {
        describe('CEIL/CEILING variants', () => {
            it('SQLite uses CEIL', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(ceil(3.2))).toBe('CEIL(?)');
                expect(dialect.compileFn(ceiling(3.2))).toBe('CEIL(?)');
            });

            it('MSSQL uses CEILING for CEIL', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(ceil(3.2))).toBe('CEILING(?)');
            });

            it('PostgreSQL/MySQL use CEIL', () => {
                const pgDialect = new TestDialect('postgres');
                const mysqlDialect = new TestDialect('mysql');
                expect(pgDialect.compileFn(ceil(3.2))).toBe('CEIL(?)');
                expect(mysqlDialect.compileFn(ceil(3.2))).toBe('CEIL(?)');
            });
        });

        describe('COT variants', () => {
            it('SQLite uses 1/TAN formula', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(cot(1))).toBe('(1.0 / TAN(?))');
            });

            it('Other dialects use native COT', () => {
                const pgDialect = new TestDialect('postgres');
                const mysqlDialect = new TestDialect('mysql');
                const mssqlDialect = new TestDialect('mssql');

                expect(pgDialect.compileFn(cot(1))).toBe('COT(?)');
                expect(mysqlDialect.compileFn(cot(1))).toBe('COT(?)');
                expect(mssqlDialect.compileFn(cot(1))).toBe('COT(?)');
            });
        });

        describe('LN variants', () => {
            it('SQL Server uses LOG for natural logarithm', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(ln(10))).toBe('LOG(?)');
            });

            it('Other dialects use LN', () => {
                const pgDialect = new TestDialect('postgres');
                const mysqlDialect = new TestDialect('mysql');
                const sqliteDialect = new TestDialect('sqlite');

                expect(pgDialect.compileFn(ln(10))).toBe('LN(?)');
                expect(mysqlDialect.compileFn(ln(10))).toBe('LN(?)');
                expect(sqliteDialect.compileFn(ln(10))).toBe('LN(?)');
            });
        });

        describe('LOG_BASE variants', () => {
            it('SQLite uses LN formula', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(logBase(10, 100))).toBe('(LN(?) / LN(?))');
            });

            it('PostgreSQL uses LOG(base, x)', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(logBase(10, 100))).toBe('LOG(?, ?)');
            });

            it('MySQL uses LOG(base, x)', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(logBase(10, 100))).toBe('LOG(?, ?)');
            });

            it('SQL Server uses LOG(x, base) - reversed args', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(logBase(10, 100))).toBe('LOG(?, ?)');
            });
        });

        describe('MOD variants', () => {
            it('SQLite uses % operator', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(mod(10, 3))).toBe('(? % ?)');
            });

            it('SQL Server uses % operator', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(mod(10, 3))).toBe('(? % ?)');
            });

            it('PostgreSQL uses MOD function', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(mod(10, 3))).toBe('MOD(?, ?)');
            });

            it('MySQL uses MOD function', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(mod(10, 3))).toBe('MOD(?, ?)');
            });
        });

        describe('ATAN2 variants', () => {
            it('SQL Server uses ATN2', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(atan2(1, 1))).toBe('ATN2(?, ?)');
            });

            it('Other dialects use ATAN2', () => {
                const pgDialect = new TestDialect('postgres');
                const mysqlDialect = new TestDialect('mysql');
                const sqliteDialect = new TestDialect('sqlite');

                expect(pgDialect.compileFn(atan2(1, 1))).toBe('ATAN2(?, ?)');
                expect(mysqlDialect.compileFn(atan2(1, 1))).toBe('ATAN2(?, ?)');
                expect(sqliteDialect.compileFn(atan2(1, 1))).toBe('ATAN2(?, ?)');
            });
        });

        describe('RANDOM/RAND variants', () => {
            it('SQLite uses RANDOM', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(random())).toBe('RANDOM()');
                expect(dialect.compileFn(rand())).toBe('RANDOM()');
            });

            it('PostgreSQL uses RANDOM', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(random())).toBe('RANDOM()');
                expect(dialect.compileFn(rand())).toBe('RANDOM()');
            });

            it('MySQL uses RAND', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(random())).toBe('RAND()');
            });

            it('SQL Server uses RAND', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(random())).toBe('RAND()');
            });
        });

        describe('POW/POWER variants', () => {
            it('SQL Server uses POWER', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(pow(2, 3))).toBe('POWER(?, ?)');
            });

            it('PostgreSQL uses POWER', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(pow(2, 3))).toBe('POWER(?, ?)');
            });

            it('MySQL/SQLite use POW', () => {
                const mysqlDialect = new TestDialect('mysql');
                const sqliteDialect = new TestDialect('sqlite');

                expect(mysqlDialect.compileFn(pow(2, 3))).toBe('POW(?, ?)');
                expect(sqliteDialect.compileFn(pow(2, 3))).toBe('POW(?, ?)');
            });
        });

        describe('TRUNC/TRUNCATE variants', () => {
            it('SQL Server uses ROUND with third parameter', () => {
                const dialect = new TestDialect('mssql');
                expect(dialect.compileFn(trunc(3.14159))).toBe('ROUND(?, 0, 1)');
                expect(dialect.compileFn(trunc(3.14159, 2))).toBe('ROUND(?, ?, 1)');
                expect(dialect.compileFn(truncate(3.14159, 2))).toBe('ROUND(?, ?, 1)');
            });

            it('PostgreSQL uses TRUNC', () => {
                const dialect = new TestDialect('postgres');
                expect(dialect.compileFn(trunc(3.14159, 2))).toBe('TRUNC(?, ?)');
                expect(dialect.compileFn(truncate(3.14159, 2))).toBe('TRUNC(?, ?)');
            });

            it('SQLite uses TRUNC', () => {
                const dialect = new TestDialect('sqlite');
                expect(dialect.compileFn(trunc(3.14159, 2))).toBe('TRUNC(?, ?)');
                expect(dialect.compileFn(truncate(3.14159, 2))).toBe('TRUNC(?, ?)');
            });

            it('MySQL uses TRUNCATE', () => {
                const dialect = new TestDialect('mysql');
                expect(dialect.compileFn(truncate(3.14159, 2))).toBe('TRUNCATE(?, ?)');
            });
        });
    });

    describe('Integration with columns', () => {
        it('accepts column definitions as arguments', () => {
            const dialect = new TestDialect('postgres');
            const col = { name: 'price', type: 'DECIMAL', table: 'products' } as const;

            expect(dialect.compileFn(abs(col))).toBe('ABS("products"."price")');
            expect(dialect.compileFn(round(col, 2))).toBe('ROUND("products"."price", ?)');
            expect(dialect.compileFn(sqrt(col))).toBe('SQRT("products"."price")');
        });
    });
});
