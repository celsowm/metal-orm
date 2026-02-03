import { describe, it, expect } from 'vitest';
import { renderEntityFile } from '../../../scripts/generate-entities/render.mjs';

describe('generate-entities tree detection', () => {
  it('emits tree decorators for nested set tables', () => {
    const schema = {
      tables: [
        {
          name: 'categories',
          columns: [
            { name: 'id', type: 'int', notNull: true, autoIncrement: true },
            {
              name: 'parent_id',
              type: 'int',
              references: { table: 'categories', column: 'id' }
            },
            { name: 'lft', type: 'int', notNull: true },
            { name: 'rght', type: 'int', notNull: true },
            { name: 'depth', type: 'int', notNull: true },
            { name: 'tenant_id', type: 'int', notNull: true },
            { name: 'name', type: 'varchar(120)', notNull: true }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    expect(output).toContain(
      "@Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght', depthKey: 'depth', scope: ['tenant_id'] })"
    );
    expect(output).toContain('Tree, TreeParent, TreeChildren');
    expect(output).toContain('@TreeParent()');
    expect(output).toContain('parent?: Category;');
    expect(output).toContain('@TreeChildren()');
    expect(output).toContain('children?: Category[];');
  });

  it('skips tree decorators when parent is not self-referencing', () => {
    const schema = {
      tables: [
        {
          name: 'groups',
          columns: [{ name: 'id', type: 'int', notNull: true }],
          primaryKey: ['id']
        },
        {
          name: 'categories',
          columns: [
            { name: 'id', type: 'int', notNull: true },
            {
              name: 'parent_id',
              type: 'int',
              references: { table: 'groups', column: 'id' }
            },
            { name: 'lft', type: 'int', notNull: true },
            { name: 'rght', type: 'int', notNull: true }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    expect(output).not.toContain('@Tree(');
    expect(output).not.toContain('@TreeParent()');
    expect(output).not.toContain('@TreeChildren()');
  });
});
