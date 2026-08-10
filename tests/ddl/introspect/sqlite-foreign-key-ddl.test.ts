import { describe, expect, it } from 'vitest';
import { parseSqliteForeignKeyModifiers } from '../../../src/core/ddl/introspect/sqlite-foreign-key-ddl.js';

describe('parseSqliteForeignKeyModifiers', () => {
  it('parses named inline deferred foreign keys', () => {
    const result = parseSqliteForeignKeyModifiers(`
      CREATE TABLE "children" (
        "id" INTEGER PRIMARY KEY,
        "parent_id" INTEGER CONSTRAINT "fk_children_parent"
          REFERENCES "parents" ("id")
          ON DELETE CASCADE
          DEFERRABLE INITIALLY DEFERRED
      );
    `);

    expect(result).toEqual([
      {
        column: 'parent_id',
        name: 'fk_children_parent',
        deferrable: true
      }
    ]);
  });

  it('parses named table-level foreign keys without treating NOT DEFERRABLE as deferred', () => {
    const result = parseSqliteForeignKeyModifiers(`
      CREATE TABLE child (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER,
        CONSTRAINT [fk_parent] FOREIGN KEY (parent_id)
          REFERENCES parent(id)
          NOT DEFERRABLE INITIALLY DEFERRED
      );
    `);

    expect(result).toEqual([
      {
        column: 'parent_id',
        name: 'fk_parent',
        deferrable: false
      }
    ]);
  });

  it('ignores commas and keywords inside quoted text and nested expressions', () => {
    const result = parseSqliteForeignKeyModifiers(`
      CREATE TABLE child (
        note TEXT DEFAULT ('REFERENCES, DEFERRABLE'),
        parent_id INTEGER CONSTRAINT \`fk_parent\`
          REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED,
        CHECK (instr(note, ',)') >= 0)
      );
    `);

    expect(result).toEqual([
      {
        column: 'parent_id',
        name: 'fk_parent',
        deferrable: true
      }
    ]);
  });
});
