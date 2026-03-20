import { describe, expect, it } from 'vitest';
import { eq, not, or } from '../../src/core/ast/expression.js';
import { remapExpressionTable } from '../../src/query-builder/expression-table-mapper.js';

describe('remapExpressionTable', () => {
  it('remaps table names inside unary not() expressions', () => {
    const expr = not(
      or(
        eq({ type: 'Column', table: 'users', name: 'id' }, 1),
        eq({ type: 'Column', table: 'users', name: 'role' }, 'admin')
      )
    );

    const mapped = remapExpressionTable(expr, 'users', 'u1');
    expect(mapped).toBeDefined();
    expect(mapped?.type).toBe('NotExpression');

    const logical = (mapped as { operand: { operands: Array<{ left: { table: string } }> } }).operand;
    expect(logical.operands[0].left.table).toBe('u1');
    expect(logical.operands[1].left.table).toBe('u1');
  });
});
