import { describe, it, expect } from 'vitest';
import type { CompilerContext } from '../src/core/dialect/abstract.js';
import { Dialect } from '../src/core/dialect/abstract.js';
import type { DialectName } from '../src/core/sql/sql.js';
import { lower, position } from '../src/core/functions/text.js';
import {
  InMemoryFunctionRegistry,
  type FunctionRegistry
} from '../src/core/functions/function-registry.js';
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

describe('Function registry (SOLID)', () => {
  it('prevents duplicate registrations per registry instance', () => {
    const registry = new InMemoryFunctionRegistry();
    registry.register({ key: 'FOO' });
    expect(() => registry.register({ key: 'FOO' })).toThrow(/already registered/i);
  });

  it('keeps separate registries isolated', () => {
    const a = new InMemoryFunctionRegistry();
    const b = new InMemoryFunctionRegistry();
    a.register({ key: 'BAR' });

    expect(a.isRegistered('BAR')).toBe(true);
    expect(b.isRegistered('BAR')).toBe(false);
  });

  it('uses injected registry when compiling functions', () => {
    const registry = new InMemoryFunctionRegistry();
    registry.register({
      key: 'CUSTOM',
      render: ({ compiledArgs }) => `custom(${compiledArgs.join(' | ')})`
    });
    const dialect = new TestDialect('postgres', registry);
    const node: FunctionNode = {
      type: 'Function',
      name: 'CUSTOM',
      fn: 'CUSTOM',
      args: [
        { type: 'Literal', value: 1 },
        { type: 'Column', table: 't', name: 'c' }
      ]
    };

    expect(dialect.compileFn(node)).toBe('custom(? | "t"."c")');
  });

  it('bootstraps default text functions and renders dialect variants', () => {
    const dialect = new TestDialect('sqlite'); // uses default registry inside Dialect ctor
    const node = position('a', { name: 'col', type: 'TEXT', table: 'tbl' });

    expect(dialect.compileFn(lower('abc'))).toBe('LOWER(?)');
    expect(dialect.compileFn(node)).toBe('instr("tbl"."col", ?)');
  });
});
