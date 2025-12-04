import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { MySqlDialect } from '../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../src/core/dialect/mssql/index.js';
import { PostgresDialect } from '../src/core/dialect/postgres/index.js';
import { TableDef } from '../src/schema/table.js';
import { rowNumber, rank, denseRank, lag, lead, ntile, firstValue, lastValue, windowFunction } from '../src/core/ast/expression.js';

const table = (name: string): TableDef => ({ name, columns: {}, relations: {} });
const col = (name: string, table?: string) => ({ type: 'Column', name, table: table || 'unknown' } as any);
const lit = (value: any) => ({ type: 'Literal', value } as any);

describe('Window Function Support', () => {
    const sqlite = new SqliteDialect();
    const mysql = new MySqlDialect();
    const mssql = new SqlServerDialect();
    const postgres = new PostgresDialect();

    it('should generate ROW_NUMBER() window function', () => {
        const users = table('users');

        const query = new SelectQueryBuilder(users)
            .select({
                id: col('id', 'users'),
                name: col('name', 'users'),
                row_num: rowNumber()
            });

        const expectedSqlite = 'SELECT "users"."id" AS "id", "users"."name" AS "name", ROW_NUMBER() OVER () AS "row_num" FROM "users";';
        const expectedMysql = 'SELECT `users`.`id` AS `id`, `users`.`name` AS `name`, ROW_NUMBER() OVER () AS `row_num` FROM `users`;';
        const expectedMssql = 'SELECT [users].[id] AS [id], [users].[name] AS [name], ROW_NUMBER() OVER () AS [row_num] FROM [users];';
        const expectedPostgres = 'SELECT "users"."id" AS "id", "users"."name" AS "name", ROW_NUMBER() OVER () AS "row_num" FROM "users";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });

    it('should generate RANK() with PARTITION BY and ORDER BY', () => {
        const orders = table('orders');

        const query = new SelectQueryBuilder(orders)
            .select({
                id: col('id', 'orders'),
                customer_id: col('customer_id', 'orders'),
                amount: col('amount', 'orders'),
                rank: windowFunction('RANK', [], [col('customer_id', 'orders')], [{ column: col('amount', 'orders'), direction: 'DESC' }])
            });

        const expectedSqlite = 'SELECT "orders"."id" AS "id", "orders"."customer_id" AS "customer_id", "orders"."amount" AS "amount", RANK() OVER (PARTITION BY "orders"."customer_id" ORDER BY "orders"."amount" DESC) AS "rank" FROM "orders";';
        const expectedMysql = 'SELECT `orders`.`id` AS `id`, `orders`.`customer_id` AS `customer_id`, `orders`.`amount` AS `amount`, RANK() OVER (PARTITION BY `orders`.`customer_id` ORDER BY `orders`.`amount` DESC) AS `rank` FROM `orders`;';
        const expectedMssql = 'SELECT [orders].[id] AS [id], [orders].[customer_id] AS [customer_id], [orders].[amount] AS [amount], RANK() OVER (PARTITION BY [orders].[customer_id] ORDER BY [orders].[amount] DESC) AS [rank] FROM [orders];';
        const expectedPostgres = 'SELECT "orders"."id" AS "id", "orders"."customer_id" AS "customer_id", "orders"."amount" AS "amount", RANK() OVER (PARTITION BY "orders"."customer_id" ORDER BY "orders"."amount" DESC) AS "rank" FROM "orders";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });

    it('should generate LAG function with offset and default value', () => {
        const sales = table('sales');

        const query = new SelectQueryBuilder(sales)
            .select({
                date: col('date', 'sales'),
                amount: col('amount', 'sales'),
                prev_amount: lag(col('amount', 'sales'), 1, 0)
            });

        const expectedSqlite = 'SELECT "sales"."date" AS "date", "sales"."amount" AS "amount", LAG("sales"."amount", ?, ?) OVER () AS "prev_amount" FROM "sales";';
        const expectedMysql = 'SELECT `sales`.`date` AS `date`, `sales`.`amount` AS `amount`, LAG(`sales`.`amount`, ?, ?) OVER () AS `prev_amount` FROM `sales`;';
        const expectedMssql = 'SELECT [sales].[date] AS [date], [sales].[amount] AS [amount], LAG([sales].[amount], @p1, @p2) OVER () AS [prev_amount] FROM [sales];';
        const expectedPostgres = 'SELECT "sales"."date" AS "date", "sales"."amount" AS "amount", LAG("sales"."amount", ?, ?) OVER () AS "prev_amount" FROM "sales";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });

    it('should generate LEAD function', () => {
        const sales = table('sales');

        const query = new SelectQueryBuilder(sales)
            .select({
                date: col('date', 'sales'),
                amount: col('amount', 'sales'),
                next_amount: lead(col('amount', 'sales'), 1)
            });

        const expectedSqlite = 'SELECT "sales"."date" AS "date", "sales"."amount" AS "amount", LEAD("sales"."amount", ?) OVER () AS "next_amount" FROM "sales";';
        const expectedMysql = 'SELECT `sales`.`date` AS `date`, `sales`.`amount` AS `amount`, LEAD(`sales`.`amount`, ?) OVER () AS `next_amount` FROM `sales`;';
        const expectedMssql = 'SELECT [sales].[date] AS [date], [sales].[amount] AS [amount], LEAD([sales].[amount], @p1) OVER () AS [next_amount] FROM [sales];';
        const expectedPostgres = 'SELECT "sales"."date" AS "date", "sales"."amount" AS "amount", LEAD("sales"."amount", ?) OVER () AS "next_amount" FROM "sales";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });

    it('should generate window function with both PARTITION BY and ORDER BY', () => {
        const employees = table('employees');

        const query = new SelectQueryBuilder(employees)
            .select({
                id: col('id', 'employees'),
                name: col('name', 'employees'),
                department: col('department', 'employees'),
                salary: col('salary', 'employees'),
                dept_rank: windowFunction('ROW_NUMBER', [], [col('department', 'employees')], [{ column: col('salary', 'employees'), direction: 'DESC' }])
            });

        const expectedSqlite = 'SELECT "employees"."id" AS "id", "employees"."name" AS "name", "employees"."department" AS "department", "employees"."salary" AS "salary", ROW_NUMBER() OVER (PARTITION BY "employees"."department" ORDER BY "employees"."salary" DESC) AS "dept_rank" FROM "employees";';
        const expectedMysql = 'SELECT `employees`.`id` AS `id`, `employees`.`name` AS `name`, `employees`.`department` AS `department`, `employees`.`salary` AS `salary`, ROW_NUMBER() OVER (PARTITION BY `employees`.`department` ORDER BY `employees`.`salary` DESC) AS `dept_rank` FROM `employees`;';
        const expectedMssql = 'SELECT [employees].[id] AS [id], [employees].[name] AS [name], [employees].[department] AS [department], [employees].[salary] AS [salary], ROW_NUMBER() OVER (PARTITION BY [employees].[department] ORDER BY [employees].[salary] DESC) AS [dept_rank] FROM [employees];';
        const expectedPostgres = 'SELECT "employees"."id" AS "id", "employees"."name" AS "name", "employees"."department" AS "department", "employees"."salary" AS "salary", ROW_NUMBER() OVER (PARTITION BY "employees"."department" ORDER BY "employees"."salary" DESC) AS "dept_rank" FROM "employees";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });

    it('should generate multiple window functions in one query', () => {
        const employees = table('employees');

        const query = new SelectQueryBuilder(employees)
            .select({
                id: col('id', 'employees'),
                name: col('name', 'employees'),
                salary: col('salary', 'employees'),
                row_num: rowNumber(),
                rank: rank(),
                dense_rank: denseRank()
            });

        const expectedSqlite = 'SELECT "employees"."id" AS "id", "employees"."name" AS "name", "employees"."salary" AS "salary", ROW_NUMBER() OVER () AS "row_num", RANK() OVER () AS "rank", DENSE_RANK() OVER () AS "dense_rank" FROM "employees";';
        const expectedMysql = 'SELECT `employees`.`id` AS `id`, `employees`.`name` AS `name`, `employees`.`salary` AS `salary`, ROW_NUMBER() OVER () AS `row_num`, RANK() OVER () AS `rank`, DENSE_RANK() OVER () AS `dense_rank` FROM `employees`;';
        const expectedMssql = 'SELECT [employees].[id] AS [id], [employees].[name] AS [name], [employees].[salary] AS [salary], ROW_NUMBER() OVER () AS [row_num], RANK() OVER () AS [rank], DENSE_RANK() OVER () AS [dense_rank] FROM [employees];';
        const expectedPostgres = 'SELECT "employees"."id" AS "id", "employees"."name" AS "name", "employees"."salary" AS "salary", ROW_NUMBER() OVER () AS "row_num", RANK() OVER () AS "rank", DENSE_RANK() OVER () AS "dense_rank" FROM "employees";';

        expect(query.toSql(sqlite)).toBe(expectedSqlite);
        expect(query.toSql(mysql)).toBe(expectedMysql);
        expect(query.toSql(mssql)).toBe(expectedMssql);
        expect(query.toSql(postgres)).toBe(expectedPostgres);
    });
});
