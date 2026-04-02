import { describe, expect, it } from 'vitest';
import { detectTreeTable } from '../../../scripts/generate-entities/tree-detection.mjs';
import { renderEntityFile } from '../../../scripts/generate-entities/render.mjs';

describe('generate-entities robustness', () => {
  it('treats malformed tree columns as non-matches instead of throwing', () => {
    const table = {
      name: 'categories',
      columns: [
        undefined,
        { name: undefined },
        { name: 'title', type: 'varchar(120)' }
      ],
      primaryKey: ['id']
    };

    expect(() => detectTreeTable(table, {})).not.toThrow();
    expect(detectTreeTable(table, {})).toBeNull();
  });

  it('renders schemas with missing columns and undefined comments', () => {
    const schema = {
      tables: [
        {
          name: 'empty_table',
          comment: undefined,
          columns: undefined,
          primaryKey: []
        },
        {
          name: 'categories',
          comment: undefined,
          columns: [
            undefined,
            { name: undefined },
            { name: 'id', type: 'int', notNull: true, autoIncrement: true },
            {
              name: 'parent_id',
              type: 'int',
              references: { table: 'categories', column: 'id' }
            },
            { name: 'lft', type: 'int', notNull: true },
            { name: 'rght', type: 'int', notNull: true },
            { name: 'notes', type: 'varchar(120)', comment: undefined }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    expect(output).toContain('export class EmptyTable {');
    expect(output).toContain('export class Category {');
    expect(output).toContain("@Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght' })");
    expect(output).toContain('notes?: string;');
  });
});
