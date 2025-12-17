import { describe, it, expect, expectTypeOf } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { defineTable, tableRef } from '../../src/schema/table.js';
import { eq } from '../../src/core/ast/expression-builders.js';

describe('tableRef', () => {
    it('provides direct column access', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean(),
            title: col.varchar(255)
        });

        const t = tableRef(todos);

        // Direct access should return the column definition
        expect(t.done).toBe(todos.columns.done);
        expect(t.id).toBe(todos.columns.id);
        expect(t.title).toBe(todos.columns.title);

        // Reference equality
        expect(t.done).toBe(todos.columns.done);
    });

    it('preserves table properties', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean()
        });

        const t = tableRef(todos);

        expect(t.name).toBe('todos');
        expect(t.columns).toBe(todos.columns);
        expect(t.relations).toBe(todos.relations);
    });

    it('handles collision with table properties', () => {
        const tableWithNameColumn = defineTable('users', {
            id: col.primaryKey(col.int()),
            name: col.varchar(255) // This collides with table.name
        });

        const t = tableRef(tableWithNameColumn);

        // table.name should return the table name (string)
        expect(t.name).toBe('users');
        expect(typeof t.name).toBe('string');

        // t.$.name should return the column definition
        expect(t.$.name).toBe(tableWithNameColumn.columns.name);
        expect(t.$.name.type).toBe('VARCHAR');

        // Direct access should not be available for colliding keys
        expect(t.name).not.toBe(tableWithNameColumn.columns.name);
    });

    it('caches proxy instances', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean()
        });

        const t1 = tableRef(todos);
        const t2 = tableRef(todos);

        expect(t1).toBe(t2); // Same proxy instance
        expect(t1.done).toBe(t2.done); // Same column reference
    });

    it('works with query builders', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean()
        });

        const t = tableRef(todos);

        // Should be able to use in eq() - this tests type compatibility
        const condition = eq(t.done, false);
        expect(condition.type).toBe('BinaryExpression');
        // eq() normalizes ColumnDef to a Column AST node
        expect(condition.left).toEqual({ type: 'Column', table: 'todos', name: 'done' });
        expect(condition.right).toEqual({ type: 'Literal', value: false });
    });

    it('type checks correctly for direct column access', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean(),
            title: col.varchar(255)
        });

        const t = tableRef(todos);

        // Type assertions
        expectTypeOf(t.done).toMatchTypeOf(todos.columns.done);
        expectTypeOf(t.id).toMatchTypeOf(todos.columns.id);
        expectTypeOf(t.title).toMatchTypeOf(todos.columns.title);

        // Table properties should maintain their types
        expectTypeOf(t.name).toMatchTypeOf<string>();
        expectTypeOf(t.columns).toMatchTypeOf(todos.columns);
    });

    it('type checks correctly for collisions', () => {
        const tableWithNameColumn = defineTable('users', {
            id: col.primaryKey(col.int()),
            name: col.varchar(255)
        });

        const t = tableRef(tableWithNameColumn);

        // t.name should be the table name (string), not the column
        expectTypeOf(t.name).toMatchTypeOf<string>();

        // t.$.name should be the column
        expectTypeOf(t.$.name).toMatchTypeOf(tableWithNameColumn.columns.name);
    });

    it('supports enumeration and property checks', () => {
        const todos = defineTable('todos', {
            id: col.primaryKey(col.int()),
            done: col.boolean()
        });

        const t = tableRef(todos);

        // has() should work
        expect('done' in t).toBe(true);
        expect('id' in t).toBe(true);
        expect('name' in t).toBe(true);
        expect('$' in t).toBe(true);
        expect('nonexistent' in t).toBe(false);

        // ownKeys should include both table props and column props
        const keys = Reflect.ownKeys(t);
        expect(keys).toContain('name');
        expect(keys).toContain('columns');
        expect(keys).toContain('done');
        expect(keys).toContain('id');
        expect(keys).toContain('$');
    });
});


