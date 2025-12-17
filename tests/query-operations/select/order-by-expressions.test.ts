import { describe, it, expect } from 'vitest';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { add, aliasRef } from '../../../src/core/ast/expression.js';

const items = defineTable('items', {
  a: col.int(),
  b: col.int(),
  name: col.varchar(255)
});

const dialect = new SqliteDialect();

describe('ORDER BY / GROUP BY expressions', () => {
  it('orders by arithmetic expressions, alias refs, collations and nulls', () => {
    const sql = new SelectQueryBuilder(items)
      .select({
        name: items.columns.name,
        a: items.columns.a,
        b: items.columns.b
      })
      .orderBy(add(items.columns.a, items.columns.b), { direction: 'DESC', nulls: 'LAST' })
      .orderBy(aliasRef('name'), { collation: 'NOCASE' })
      .toSql(dialect);

    expect(sql).toContain('ORDER BY ("items"."a" + "items"."b") DESC NULLS LAST, "name" ASC COLLATE NOCASE;');
  });

  it('groups by expressions', () => {
    const sql = new SelectQueryBuilder(items)
      .select({
        name: items.columns.name
      })
      .groupBy(add(items.columns.a, items.columns.b))
      .toSql(dialect);

    expect(sql).toContain('GROUP BY ("items"."a" + "items"."b")');
  });
});


