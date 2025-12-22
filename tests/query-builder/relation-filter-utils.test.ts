import { describe, expect, it } from 'vitest';

import { and, eq, inSubquery } from '../../src/core/ast/expression.js';
import { splitFilterExpressions } from '../../src/query-builder/relation-filter-utils.js';
import { SelectQueryNode } from '../../src/core/ast/query.js';

const makeSubquery = (table: string): SelectQueryNode => ({
  type: 'SelectQuery',
  from: { type: 'Table', name: table },
  columns: [{ type: 'Column', table, name: 'id' }],
  joins: []
});

describe('splitFilterExpressions', () => {
  it('splits AND filters into self and cross buckets', () => {
    const postsFilter = eq({ type: 'Column', table: 'posts', name: 'title' }, 'hello');
    const usersFilter = eq({ type: 'Column', table: 'users', name: 'id' }, 123);
    const filter = and(postsFilter, usersFilter);

    const result = splitFilterExpressions(filter, new Set(['posts']));

    expect(result.selfFilters).toEqual([postsFilter]);
    expect(result.crossFilters).toEqual([usersFilter]);
  });

  it('treats subqueries as cross filters', () => {
    const filter = inSubquery({ type: 'Column', table: 'posts', name: 'id' }, makeSubquery('comments'));

    const result = splitFilterExpressions(filter, new Set(['posts']));

    expect(result.selfFilters).toEqual([]);
    expect(result.crossFilters).toEqual([filter]);
  });

  it('collects tables referenced by function order-by clauses', () => {
    const functionNode = {
      type: 'Function' as const,
      name: 'group_concat',
      args: [{ type: 'Column' as const, table: 'posts', name: 'title' }],
      orderBy: [
        {
          type: 'OrderBy' as const,
          term: { type: 'Column' as const, table: 'posts', name: 'createdAt' },
          direction: 'ASC' as const
        }
      ]
    };
    const filter = eq(functionNode, 'value');

    const result = splitFilterExpressions(filter, new Set(['posts']));

    expect(result.selfFilters).toEqual([filter]);
    expect(result.crossFilters).toEqual([]);
  });
});
