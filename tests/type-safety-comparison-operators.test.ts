import { describe, expect, it } from 'vitest';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column-types.js';
import { eq, gt, inList } from '../src/core/ast/expression-builders.js';

describe('comparison operator type safety', () => {
  const users = defineTable('users', {
    id: col.int(),
    createdAt: col.timestamp<Date>()
  });

  it('rejects arrays for scalar comparison operators at type-check time', () => {
    if (false) {
      // @ts-expect-error eq() should reject arrays and suggest inList()
      eq(users.columns.id, [1, 2, 3]);

      // @ts-expect-error gt() should reject arrays
      gt(users.columns.createdAt, [new Date()]);
    }

    expect(true).toBe(true);
  });

  it('accepts arrays with inList()', () => {
    const expr = inList(users.columns.id, [1, 2, 3]);
    expect(expr.type).toBe('InExpression');
  });
});
