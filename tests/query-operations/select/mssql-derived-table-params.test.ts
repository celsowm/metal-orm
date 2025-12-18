import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { countAll, eq } from '../../../src/core/ast/expression.js';

const Users = defineTable('users', {
    id: col.primaryKey(col.int())
});

describe('MSSQL derived table parameters', () => {
    it('keeps compiler context when compiling derived tables', () => {
        const subquery = new SelectQueryBuilder(Users)
            .selectRaw('id')
            .where(eq(Users.columns.id, 1));

        const query = new SelectQueryBuilder(Users)
            .fromSubquery(subquery, '__metal_count')
            .select({ total: countAll() });

        const compiled = query.compile(new SqlServerDialect());

        expect(compiled.sql).toContain('COUNT(*)');
        expect(compiled.sql).toContain(
            'FROM (SELECT [users].[id] FROM [users] WHERE [users].[id] = @p1) AS [__metal_count]'
        );
        expect(compiled.params).toEqual([1]);
    });
});
