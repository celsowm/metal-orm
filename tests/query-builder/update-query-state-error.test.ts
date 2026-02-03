import { describe, it, expect } from 'vitest';
import { UpdateQueryState } from '../../src/query-builder/update-query-state.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';

describe('UpdateQueryState - Error Messages', () => {
  it('should throw error with dynamic type list for invalid update value', () => {
    const table = defineTable('users', {
      id: col.primaryKey(col.int()),
      name: col.text()
    });

    const updateState = new UpdateQueryState(table);

    // Test with an invalid value (object)
    expect(() => {
      updateState.withSet({
        name: { invalid: 'object' } as any
      });
    }).toThrowError(
      'Invalid update value for column "name": only string, number, boolean, Date, Buffer, null, OperandNode are allowed'
    );
  });

  it('should accept valid literal values', () => {
    const table = defineTable('users', {
      id: col.primaryKey(col.int()),
      name: col.text(),
      age: col.int(),
      active: col.boolean(),
      createdAt: col.timestamp(),
      avatar: col.blob()
    });

    const updateState = new UpdateQueryState(table);

    // Should not throw for valid values
    expect(() => {
      updateState.withSet({
        name: 'John',
        age: 30,
        active: true,
        createdAt: new Date(),
        avatar: Buffer.from('abc'),
        nullable: null
      });
    }).not.toThrow();
  });
});
