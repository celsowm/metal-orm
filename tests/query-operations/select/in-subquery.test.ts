import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column.js';
import { inSubquery, notInSubquery, eq } from '../../../src/core/ast/expression.js';

const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255)
});

const Orders = defineTable('orders', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  status: col.varchar(50)
});

const dialect = new SqliteDialect();

describe('IN subquery expressions', () => {
  it('compiles IN with a subquery builder', () => {
    const subquery = new SelectQueryBuilder(Orders)
      .select({ userId: Orders.columns.user_id })
      .where(eq(Orders.columns.status, 'completed'));

    const query = new SelectQueryBuilder(Users)
      .select({ id: Users.columns.id })
      .where(inSubquery(Users.columns.id, subquery));

    const { sql, params } = query.compile(dialect);

    expect(sql).toContain('"users"."id" IN');
    expect(sql).toContain('SELECT');
    expect(sql).toContain('"orders"."status" = ?');
    expect(params).toEqual(['completed']);
  });

  it('compiles NOT IN with a subquery builder', () => {
    const subquery = new SelectQueryBuilder(Orders)
      .select({ userId: Orders.columns.user_id })
      .where(eq(Orders.columns.status, 'pending'));

    const query = new SelectQueryBuilder(Users)
      .select({ id: Users.columns.id })
      .where(notInSubquery(Users.columns.id, subquery));

    const { sql, params } = query.compile(dialect);

    expect(sql).toContain('"users"."id" NOT IN');
    expect(sql).toContain('SELECT');
    expect(sql).toContain('"orders"."status" = ?');
    expect(params).toEqual(['pending']);
  });
});
