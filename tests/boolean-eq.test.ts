import { describe, expect, it } from 'vitest';
import { eq, neq } from '../src/core/ast/expression-builders.js';

describe('Boolean support in eq/neq functions', () => {
  it('should support boolean true in eq function', () => {
    const result = eq({ type: 'Column', table: 'users', name: 'active' }, true);
    expect(result).toEqual({
      type: 'BinaryExpression',
      left: { type: 'Column', table: 'users', name: 'active' },
      operator: '=',
      right: { type: 'Literal', value: true }
    });
  });

  it('should support boolean false in eq function', () => {
    const result = eq({ type: 'Column', table: 'users', name: 'active' }, false);
    expect(result).toEqual({
      type: 'BinaryExpression',
      left: { type: 'Column', table: 'users', name: 'active' },
      operator: '=',
      right: { type: 'Literal', value: false }
    });
  });

  it('should support boolean true in neq function', () => {
    const result = neq({ type: 'Column', table: 'users', name: 'active' }, true);
    expect(result).toEqual({
      type: 'BinaryExpression',
      left: { type: 'Column', table: 'users', name: 'active' },
      operator: '!=',
      right: { type: 'Literal', value: true }
    });
  });

  it('should support boolean false in neq function', () => {
    const result = neq({ type: 'Column', table: 'users', name: 'active' }, false);
    expect(result).toEqual({
      type: 'BinaryExpression',
      left: { type: 'Column', table: 'users', name: 'active' },
      operator: '!=',
      right: { type: 'Literal', value: false }
    });
  });

  it('should still support string and number types in eq function', () => {
    const stringResult = eq({ type: 'Column', table: 'users', name: 'name' }, 'test');
    expect(stringResult.right).toEqual({ type: 'Literal', value: 'test' });

    const numberResult = eq({ type: 'Column', table: 'users', name: 'age' }, 25);
    expect(numberResult.right).toEqual({ type: 'Literal', value: 25 });
  });
});
