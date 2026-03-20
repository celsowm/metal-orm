import { describe, expect, it } from 'vitest';
import { TypeScriptGenerator } from '../../src/codegen/typescript.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq, not, or } from '../../src/core/ast/expression.js';
import { Users } from '../fixtures/schema.js';

describe('TypeScriptGenerator - unary not()', () => {
  it('renders not(...) expressions in where()', () => {
    const ast = new SelectQueryBuilder(Users)
      .selectRaw('*')
      .where(not(or(eq(Users.columns.id, 1), eq(Users.columns.role, 'admin'))))
      .getAST();

    const generated = new TypeScriptGenerator().generate(ast);

    expect(generated).toContain('.where(not(or(');
    expect(generated).toContain('eq(Users.id, 1)');
    expect(generated).toContain("eq(Users.role, 'admin')");
  });
});
