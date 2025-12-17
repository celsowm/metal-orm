import { expect, test } from 'vitest';
import { DialectFactory, type DialectKey } from '../../src/core/dialect/dialect-factory.js';
import { cast } from '../../src/core/ast/expression-builders.js';
import type { SelectQueryNode } from '../../src/core/ast/query.js';

const dialects: DialectKey[] = ['postgres', 'mysql', 'sqlite', 'mssql'];

test.each(dialects)('dialect %s compiles CAST expressions', dialectKey => {
  const dialect = DialectFactory.create(dialectKey);
  const ast: SelectQueryNode = {
    type: 'SelectQuery',
    from: { type: 'Table', name: 'users' },
    columns: [cast(1, 'varchar(10)')],
    joins: []
  };

  const result = dialect.compileSelect(ast);
  const normalizedSql = result.sql.toLowerCase();
  expect(normalizedSql).toContain('cast(');
  expect(normalizedSql).toContain(' as varchar(10)');
  expect(result.params).toEqual([1]);
});
