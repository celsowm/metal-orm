import { describe, expect, it } from 'vitest';
import { jsonify } from '../../src/orm/jsonify.js';

describe('jsonify', () => {
  it('converts top-level Date values to ISO strings', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    const input = { createdAt: date, count: 2 };

    const out = jsonify(input);

    expect(out).toEqual({ createdAt: date.toISOString(), count: 2 });
    expect(out).not.toBe(input);
  });
});

