import { describe, expect, it } from 'vitest';
import { eq } from '../../src/core/ast/expression-builders.js';

describe('expression-builders operand guards', () => {
  it('throws a clear error when array is passed to eq()', () => {
    expect(() =>
      eq({ type: 'Column', table: 'users', name: 'id' }, [1, 2] as unknown as string)
    ).toThrowError(/Use inList\/notInList/);
  });
});
