import { describe, it, expect } from 'vitest';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SelectQueryNode } from '../../../src/core/ast/query.js';
import { tvf } from '../../../src/core/ast/builders.js';
import type { ColumnNode, LiteralNode } from '../../../src/core/ast/expression-nodes.js';

describe('TableFunctionStrategy & tvf helper', () => {
  const postgresDialect = new PostgresDialect();
  const sqliteDialect = new SqliteDialect();
  const arrayLiteral: LiteralNode = { type: 'Literal', value: '{1,2,3}' };

  it('renders ARRAY_UNNEST via the Postgres table function strategy', () => {
    const query: SelectQueryNode = {
      type: 'SelectQuery',
      from: tvf('ARRAY_UNNEST', [arrayLiteral], 'arr', {
        withOrdinality: true,
        columnAliases: ['value', 'ordinal']
      }),
      columns: [
        { type: 'Column', table: 'arr', name: 'value' } as ColumnNode,
        { type: 'Column', table: 'arr', name: 'ordinal' } as ColumnNode
      ],
      joins: []
    };

    const sql = postgresDialect.compileSelect(query).sql;
    expect(sql).toContain('LATERAL');
    expect(sql).toContain('unnest');
    expect(sql).toContain('WITH ORDINALITY');
    expect(sql).toContain('AS "arr"');
    expect(sql).toContain('("value", "ordinal")');
  });

  it('fails fast when column aliases are provided without an alias', () => {
    const query: SelectQueryNode = {
      type: 'SelectQuery',
      from: tvf('ARRAY_UNNEST', [arrayLiteral], undefined, {
        withOrdinality: true,
        columnAliases: ['value']
      }),
      columns: [
        { type: 'Column', table: 'arr', name: 'value' } as ColumnNode
      ],
      joins: []
    };

    expect(() => postgresDialect.compileSelect(query)).toThrow(
      'tvf(ARRAY_UNNEST) with columnAliases requires an alias.'
    );
  });

  it('throws when an intent key is unsupported by the dialect', () => {
    const query: SelectQueryNode = {
      type: 'SelectQuery',
      from: tvf('ARRAY_UNNEST', [arrayLiteral], 'arr'),
      columns: [
        { type: 'Column', table: 'arr', name: 'value' } as ColumnNode
      ],
      joins: []
    };

    expect(() => sqliteDialect.compileSelect(query)).toThrow(
      'Table function "ARRAY_UNNEST" is not supported by dialect "sqlite".'
    );
  });
});
