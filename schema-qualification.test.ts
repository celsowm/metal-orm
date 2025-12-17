import { describe, it, expect } from 'vitest';

import { defineTable } from './src/schema/table.js';
import { col } from './src/schema/column-types.js';
import { hasMany, belongsToMany } from './src/schema/relation.js';
import { SelectQueryBuilder } from './src/query-builder/select.js';
import { InsertQueryBuilder } from './src/query-builder/insert.js';
import { UpdateQueryBuilder } from './src/query-builder/update.js';
import { DeleteQueryBuilder } from './src/query-builder/delete.js';
import { eq } from './src/core/ast/expression.js';
import { createJoinNode } from './src/core/ast/join-node.js';
import { JOIN_KINDS } from './src/core/sql/sql.js';
import { DialectFactory } from './src/core/dialect/dialect-factory.js';

type DialectKey = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

const q = (dialect: DialectKey, schema: string, table: string): string => {
    switch (dialect) {
        case 'mysql':
            return `\`${schema}\`.\`${table}\``;
        case 'mssql':
            return `[${schema}].[${table}]`;
        case 'postgres':
        case 'sqlite':
            return `"${schema}"."${table}"`;
    }
};

describe('schema-qualified table rendering (schema.table)', () => {
    const users = defineTable(
        'users',
        {
            id: col.primaryKey(col.int()),
            name: col.varchar(255),
        },
        {},
        undefined,
        { schema: 'hr' }
    );

    const orders = defineTable(
        'orders',
        {
            id: col.primaryKey(col.int()),
            user_id: col.int(),
        },
        {},
        undefined,
        { schema: 'sales' }
    );

    it.each([
        ['postgres'],
        ['mysql'],
        ['sqlite'],
        ['mssql'],
    ] as const)('SELECT + explicit JOIN retains schema on %s', (dialect) => {
        const qb = new SelectQueryBuilder(users)
            .select({ id: users.columns.id })
            .innerJoin(orders, eq(users.columns.id, orders.columns.user_id));

        const sql = qb.toSql(dialect);
        expect(sql).toContain(`FROM ${q(dialect, 'hr', 'users')}`);
        expect(sql).toContain(`JOIN ${q(dialect, 'sales', 'orders')}`);
    });

    it.each([
        ['postgres'],
        ['mysql'],
        ['sqlite'],
        ['mssql'],
    ] as const)('string-qualified join target `schema.table` is parsed on %s', (dialect) => {
        const condition = eq(users.columns.id, 1);
        const ast = {
            type: 'SelectQuery',
            from: { type: 'Table', name: 'users', schema: 'hr' },
            columns: [{ type: 'Column', table: 'users', name: 'id' }],
            joins: [createJoinNode(JOIN_KINDS.INNER, 'sales.orders', condition)],
        } as const;

        // Using the dialect directly avoids DML-specific constraints like DELETE ... USING.
        const sql = DialectFactory.create(dialect).compileSelect(ast as any).sql;

        expect(sql).toContain(`JOIN ${q(dialect, 'sales', 'orders')}`);
    });

    it.each([
        ['postgres'],
        ['mysql'],
        ['sqlite'],
        ['mssql'],
    ] as const)('INSERT/UPDATE/DELETE targets retain schema on %s', (dialect) => {
        const insert = new InsertQueryBuilder(users)
            .values({ id: 1, name: 'a' })
            .compile(dialect).sql;
        expect(insert).toContain(`INSERT INTO ${q(dialect, 'hr', 'users')}`);

        const update = new UpdateQueryBuilder(users)
            .set({ name: 'b' })
            .where(eq(users.columns.id, 1))
            .compile(dialect).sql;
        expect(update).toContain(`UPDATE ${q(dialect, 'hr', 'users')}`);

        const del = new DeleteQueryBuilder(users)
            .where(eq(users.columns.id, 1))
            .compile(dialect).sql;
        expect(del).toContain(`FROM ${q(dialect, 'hr', 'users')}`);
    });

    it.each([
        ['postgres'],
        ['mysql'],
        ['sqlite'],
        ['mssql'],
    ] as const)('relation joins retain schema on %s', (dialect) => {
        const usersWithRel = defineTable(
            'users',
            {
                id: col.primaryKey(col.int()),
            },
            {
                orders: hasMany(orders, 'user_id'),
            },
            undefined,
            { schema: 'hr' }
        );

        const sql = new SelectQueryBuilder(usersWithRel)
            .select({ id: usersWithRel.columns.id })
            .joinRelation('orders')
            .toSql(dialect);

        expect(sql).toContain(`FROM ${q(dialect, 'hr', 'users')}`);
        expect(sql).toContain(`JOIN ${q(dialect, 'sales', 'orders')}`);
    });

    it.each([
        ['postgres'],
        ['mysql'],
        ['sqlite'],
        ['mssql'],
    ] as const)('belongsToMany joins retain schema (pivot + target) on %s', (dialect) => {
        const pivot = defineTable(
            'user_roles',
            {
                user_id: col.int(),
                role_id: col.int(),
            },
            {},
            undefined,
            { schema: 'auth' }
        );

        const roles = defineTable(
            'roles',
            {
                id: col.primaryKey(col.int()),
            },
            {},
            undefined,
            { schema: 'authz' }
        );

        const usersBtm = defineTable(
            'users',
            {
                id: col.primaryKey(col.int()),
            },
            {
                roles: belongsToMany(roles, pivot, {
                    pivotForeignKeyToRoot: 'user_id',
                    pivotForeignKeyToTarget: 'role_id',
                }),
            },
            undefined,
            { schema: 'hr' }
        );

        const sql = new SelectQueryBuilder(usersBtm)
            .select({ id: usersBtm.columns.id })
            .joinRelation('roles')
            .toSql(dialect);

        expect(sql).toContain(`FROM ${q(dialect, 'hr', 'users')}`);
        expect(sql).toContain(`JOIN ${q(dialect, 'auth', 'user_roles')}`);
        expect(sql).toContain(`JOIN ${q(dialect, 'authz', 'roles')}`);
    });
});
