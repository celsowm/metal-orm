import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/builder/select';
import { SqliteDialect } from '../src/dialect/sqlite';
import { MySqlDialect } from '../src/dialect/mysql';
import { SqlServerDialect } from '../src/dialect/mssql';
import { TableDef } from '../src/schema/table';
import { eq } from '../src/ast/expression';

const table = (name: string): TableDef => ({ name, columns: {}, relations: {} });
const col = (name: string, table?: string) => ({ type: 'Column', name, table: table || 'unknown' } as any);
const lit = (value: any) => ({ type: 'Literal', value } as any);

describe('CTE Support', () => {
    const sqlite = new SqliteDialect();
    const mysql = new MySqlDialect();
    const mssql = new SqlServerDialect();

    it('should generate a simple CTE', () => {
        const users = table('users');
        const cte = new SelectQueryBuilder(users)
            .selectRaw('id', 'name')
            .where(eq(col('id', 'users'), lit(1)));

        const query = new SelectQueryBuilder(table('cte_users'))
            .with('cte_users', cte)
            .selectRaw('id', 'name');

        expect(query.toSql(sqlite)).toBe('WITH "cte_users" AS (SELECT "users"."id", "users"."name" FROM "users" WHERE "users"."id" = ?) SELECT "cte_users"."id", "cte_users"."name" FROM "cte_users";');
    });

    it('should generate a recursive CTE', () => {
        const numbers = table('numbers');
        const cte = new SelectQueryBuilder(numbers)
            .selectRaw('n')
            .where(eq(col('n', 'numbers'), lit(1)));

        // Recursive part usually involves UNION, but our builder might not support UNION yet?
        // The task didn't mention UNION.
        // But we can test the RECURSIVE keyword generation at least.

        const query = new SelectQueryBuilder(table('cte_numbers'))
            .withRecursive('cte_numbers', cte)
            .selectRaw('n');

        expect(query.toSql(sqlite)).toBe('WITH RECURSIVE "cte_numbers" AS (SELECT "numbers"."n" FROM "numbers" WHERE "numbers"."n" = ?) SELECT "cte_numbers"."n" FROM "cte_numbers";');
        expect(query.toSql(mysql)).toBe('WITH RECURSIVE `cte_numbers` AS (SELECT `numbers`.`n` FROM `numbers` WHERE `numbers`.`n` = ?) SELECT `cte_numbers`.`n` FROM `cte_numbers`;');
        // MSSQL should NOT have RECURSIVE
        expect(query.toSql(mssql)).toBe('WITH [cte_numbers] AS (SELECT [numbers].[n] FROM [numbers] WHERE [numbers].[n] = @p1) SELECT [cte_numbers].[n] FROM [cte_numbers];');
    });

    it('should generate CTE with column aliases', () => {
        const users = table('users');
        const cte = new SelectQueryBuilder(users)
            .selectRaw('id', 'name');

        const query = new SelectQueryBuilder(table('cte_users'))
            .with('cte_users', cte, ['user_id', 'user_name'])
            .selectRaw('user_id');

        expect(query.toSql(sqlite)).toBe('WITH "cte_users"("user_id", "user_name") AS (SELECT "users"."id", "users"."name" FROM "users") SELECT "cte_users"."user_id" FROM "cte_users";');
    });

    it('should support multiple CTEs', () => {
        const users = table('users');
        const orders = table('orders');

        const cte1 = new SelectQueryBuilder(users).selectRaw('id');
        const cte2 = new SelectQueryBuilder(orders).selectRaw('total');

        const query = new SelectQueryBuilder(table('main'))
            .with('u', cte1)
            .with('o', cte2)
            .selectRaw('u.id', 'o.total');

        expect(query.toSql(sqlite)).toBe('WITH "u" AS (SELECT "users"."id" FROM "users"), "o" AS (SELECT "orders"."total" FROM "orders") SELECT "main"."u.id", "main"."o.total" FROM "main";');
    });
});
