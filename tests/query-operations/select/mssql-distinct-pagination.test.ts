import { describe, it, expect } from 'vitest';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { selectFrom } from '../../../src/query/index.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255)
});

describe('MSSQL distinct pagination', () => {
  it('uses ORDER BY 1 when DISTINCT pagination has no explicit orderBy', () => {
    const sql = selectFrom(users)
      .select('id')
      .distinct(users.columns.id)
      .limit(5)
      .offset(10)
      .toSql(new SqlServerDialect());

    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('ORDER BY 1 OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY');
  });
});

