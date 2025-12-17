import { describe, it, expect } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { eq } from '../../src/core/ast/expression-builders.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';

describe('README Level 1 - Tiny table, tiny query', () => {
  it('should create a simple query and compile to SQL', () => {
    // 1) A very small table
    const todos = defineTable('todos', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
      done: col.boolean(),
    });

    // 2) Build a simple query
    const listOpenTodos = new SelectQueryBuilder(todos)
      .select({
        id: todos.columns.id,
        title: todos.columns.title,
        done: todos.columns.done,
      })
      .where(eq(todos.columns.done, 0)) // Use 0 for false in MySQL
      .orderBy(todos.columns.id, 'ASC');

    // 3) Compile to SQL + params
    const dialect = new MySqlDialect();
    const { sql, params } = listOpenTodos.compile(dialect);

    // Verify SQL structure
    expect(sql).toContain('SELECT');
    expect(sql).toContain('todos');
    expect(sql).toContain('WHERE');
    expect(sql).toContain('done');
    expect(params).toEqual([0]); // false becomes 0 in MySQL
  });
});


