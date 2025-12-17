import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from './src/query-builder/select.js';
import { defineTable } from './src/schema/table.js';
import { col } from './src/schema/column-types.js';
import { eq } from './src/core/ast/expression.js';
import { DialectFactory } from './src/core/dialect/dialect-factory.js';
import { SqliteDialect } from './src/core/dialect/sqlite/index.js';

describe('DialectFactory + SelectQueryBuilder string dialect key', () => {
  // Sanity check: built-in registration works and can be overridden
  it('resolves built-in sqlite dialect', () => {
    const dialect = DialectFactory.create('sqlite');
    expect(dialect).toBeInstanceOf(SqliteDialect);
  });

  it('allows compiling with a string dialect key', () => {
    const todos = defineTable('todos', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
      done: col.boolean()
    });

    const qb = new SelectQueryBuilder(todos)
      .select({
        id: todos.columns.id,
        title: todos.columns.title
      })
      .where(eq(todos.columns.done, 0));

    const compiled = qb.compile('sqlite');

    expect(compiled.sql).toContain('FROM "todos"');
    expect(compiled.params).toEqual([0]);
  });
});
