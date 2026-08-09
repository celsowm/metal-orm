import { describe, expect, it } from 'vitest';
import type { Dialect } from '../../src/core/dialect/abstract.js';
import { DialectFactory } from '../../src/core/dialect/dialect-factory.js';
import {
  isProcedureCompiler,
  type ProcedureCompiler
} from '../../src/core/dialect/capabilities/procedure-compiler.js';

const composedDialect: Dialect = {
  quoteIdentifier: id => `"${id}"`,
  supportsDmlReturningClause: () => false,
  compileSelect: () => ({ sql: 'SELECT 1;', params: [] }),
  compileInsert: () => ({ sql: 'INSERT INTO x DEFAULT VALUES;', params: [] }),
  compileUpdate: () => ({ sql: 'UPDATE x SET y = 1;', params: [] }),
  compileDelete: () => ({ sql: 'DELETE FROM x;', params: [] })
};

describe('structural dialect composition', () => {
  it('registers a dialect without extending a MetalORM base class', () => {
    DialectFactory.register('composed-test', () => composedDialect);

    const resolved = DialectFactory.create('composed-test');

    expect(resolved).toBe(composedDialect);
    expect(resolved.quoteIdentifier('users')).toBe('"users"');
    expect(isProcedureCompiler(resolved)).toBe(false);
  });

  it('adds optional capabilities by composition', () => {
    const procedural: Dialect & ProcedureCompiler = {
      ...composedDialect,
      compileProcedureCall: ast => ({
        sql: `CALL ${composedDialect.quoteIdentifier(ast.ref.name)}();`,
        params: [],
        outParams: { source: 'none', names: [] }
      })
    };

    DialectFactory.register('composed-procedure-test', () => procedural);

    const resolved = DialectFactory.create('composed-procedure-test');
    expect(isProcedureCompiler(resolved)).toBe(true);
  });
});
