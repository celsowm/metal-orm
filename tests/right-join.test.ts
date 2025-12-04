import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { TableDef } from '../src/schema/table.js';
import { eq } from '../src/core/ast/expression.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { MySqlDialect } from '../src/core/dialect/mysql/index.js';
import { SqlServerDialect } from '../src/core/dialect/mssql/index.js';

const Users: TableDef = {
    name: 'users',
    columns: {
        id: { name: 'id', type: 'integer' },
        name: { name: 'name', type: 'text' }
    },
    relations: {
        orders: {
            type: 'HAS_MANY',
            target: {
                name: 'orders',
                columns: {
                    id: { name: 'id', type: 'integer' },
                    user_id: { name: 'user_id', type: 'integer' },
                    total: { name: 'total', type: 'integer' }
                },
                relations: {}
            },
            foreignKey: 'user_id',
            localKey: 'id'
        }
    }
};

const Orders = Users.relations.orders.target;

describe('RIGHT JOIN Support', () => {
    it('should generate correct SQL for manual rightJoin', () => {
        const qb = new SelectQueryBuilder(Users)
            .select({
                user: { ...Users.columns.name, table: 'users' },
                total: { ...Orders.columns.total, table: 'orders' }
            })
            .rightJoin(Orders, eq({ ...Users.columns.id, table: 'users' }, { ...Orders.columns.user_id, table: 'orders' }));

        const sqlite = new SqliteDialect();
        expect(qb.toSql(sqlite)).toBe('SELECT "users"."name" AS "user", "orders"."total" AS "total" FROM "users" RIGHT JOIN "orders" ON "users"."id" = "orders"."user_id";');
    });

    it('should generate correct SQL for manual leftJoin', () => {
        const qb = new SelectQueryBuilder(Users)
            .select({
                user: { ...Users.columns.name, table: 'users' },
                total: { ...Orders.columns.total, table: 'orders' }
            })
            .leftJoin(Orders, eq({ ...Users.columns.id, table: 'users' }, { ...Orders.columns.user_id, table: 'orders' }));

        const sqlite = new SqliteDialect();
        expect(qb.toSql(sqlite)).toBe('SELECT "users"."name" AS "user", "orders"."total" AS "total" FROM "users" LEFT JOIN "orders" ON "users"."id" = "orders"."user_id";');
    });

    it('should generate correct SQL for joinRelation with RIGHT kind', () => {
        const qb = new SelectQueryBuilder(Users)
            .select({
                user: { ...Users.columns.name, table: 'users' },
                total: { ...Orders.columns.total, table: 'orders' }
            })
            .joinRelation('orders', 'RIGHT');

        const sqlite = new SqliteDialect();
        expect(qb.toSql(sqlite)).toBe('SELECT "users"."name" AS "user", "orders"."total" AS "total" FROM "users" RIGHT JOIN "orders" ON "orders"."user_id" = "users"."id";');
    });

    it('should work with MySQL dialect', () => {
        const qb = new SelectQueryBuilder(Users)
            .select({ user: { ...Users.columns.name, table: 'users' } })
            .rightJoin(Orders, eq({ ...Users.columns.id, table: 'users' }, { ...Orders.columns.user_id, table: 'orders' }));

        const mysql = new MySqlDialect();
        expect(qb.toSql(mysql)).toBe('SELECT `users`.`name` AS `user` FROM `users` RIGHT JOIN `orders` ON `users`.`id` = `orders`.`user_id`;');
    });

    it('should work with MSSQL dialect', () => {
        const qb = new SelectQueryBuilder(Users)
            .select({ user: { ...Users.columns.name, table: 'users' } })
            .rightJoin(Orders, eq({ ...Users.columns.id, table: 'users' }, { ...Orders.columns.user_id, table: 'orders' }));

        const mssql = new SqlServerDialect();
        expect(qb.toSql(mssql)).toBe('SELECT [users].[name] AS [user] FROM [users] RIGHT JOIN [orders] ON [users].[id] = [orders].[user_id];');
    });
});
