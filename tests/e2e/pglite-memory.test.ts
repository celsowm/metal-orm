import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { PostgresSchemaDialect } from '../../src/core/ddl/dialects/postgres-schema-dialect.js';
import {
  stopPgliteServer,
  createPgliteServer,
  runSql,
  queryAll
} from './pglite-helpers.js';

const Users = defineTable('users', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.varchar(255),
  role: col.varchar(50),
  settings: col.json(),
  deleted_at: col.varchar(50)
});

const seedUsers = async (db: PGlite): Promise<void> => {
  await runSql(
    db,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES ($1, $2, $3, $4);',
    ['Alice', 'admin', '{"layout":"grid"}', null]
  );

  await runSql(
    db,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES ($1, $2, $3, $4);',
    ['Bob', 'user', '{"layout":"stack"}', null]
  );
};

describe('PostgreSQL pglite e2e', () => {
  it('executes a SelectQueryBuilder against pglite in-memory', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Users);
      await seedUsers(setup.db);

      const adminUsers = await new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name,
          role: Users.columns.role,
          settings: Users.columns.settings,
          deleted_at: Users.columns.deleted_at
        })
        .where(eq(Users.columns.role, 'admin'))
        .orderBy(Users.columns.id)
        .execute(setup.session);

      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].name).toBe('Alice');
      expect(adminUsers[0].role).toBe('admin');
      expect(adminUsers[0].settings).toEqual({ layout: 'grid' });

      const allUsers = await new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name
        })
        .orderBy(Users.columns.id)
        .execute(setup.session);

      expect(allUsers.map(u => u.name)).toEqual(['Alice', 'Bob']);
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('supports raw column selection without schema columns', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Users);
      await seedUsers(setup.db);

      const rawBuilder = new SelectQueryBuilder(Users)
        .selectRaw('id', 'name', 'role')
        .where(eq({ table: Users.name, name: 'role' }, 'user'));
      const rawUsers = await rawBuilder.execute(setup.session);

      expect(rawUsers).toHaveLength(1);
      expect(rawUsers[0].name).toBe('Bob');
      expect(rawUsers[0].role).toBe('user');
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('demonstrates col() function usage for table definition', async () => {
    const setup = await createPgliteServer();

    try {
      const Products = defineTable('products', {
        id: col.primaryKey(col.autoIncrement(col.int())),
        name: col.varchar(255),
        price: col.decimal(10, 2),
        category: col.varchar(100),
        stock: col.int()
      });

      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Products);

      await runSql(
        setup.db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES ($1, $2, $3, $4);`,
        ['Laptop', 999.99, 'Electronics', 10]
      );

      await runSql(
        setup.db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES ($1, $2, $3, $4);`,
        ['Smartphone', 699.99, 'Electronics', 25]
      );

      await runSql(
        setup.db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES ($1, $2, $3, $4);`,
        ['Desk Chair', 199.99, 'Furniture', 15]
      );

      const allProducts = await new SelectQueryBuilder(Products)
        .select({
          id: Products.columns.id,
          name: Products.columns.name,
          category: Products.columns.category,
          stock: Products.columns.stock
        })
        .orderBy(Products.columns.name)
        .execute(setup.session);

      expect(allProducts).toHaveLength(3);
      expect(allProducts.map(p => p.name)).toEqual(['Desk Chair', 'Laptop', 'Smartphone']);

      const electronics = await new SelectQueryBuilder(Products)
        .select({
          id: Products.columns.id,
          name: Products.columns.name,
          price: Products.columns.price,
          category: Products.columns.category
        })
        .where(eq({ table: Products.name, name: 'category' }, 'Electronics'))
        .orderBy(Products.columns.id)
        .execute(setup.session);

      expect(electronics).toHaveLength(2);
      expect(electronics[0].name).toBe('Laptop');
      expect(electronics[0].category).toBe('Electronics');
      expect(electronics[1].name).toBe('Smartphone');
      expect(electronics[1].category).toBe('Electronics');
    } finally {
      await stopPgliteServer(setup);
    }
  });

  it('demonstrates transactions with pglite', async () => {
    const setup = await createPgliteServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new PostgresSchemaDialect(), Users);

      await setup.session.executor.beginTransaction();
      try {
        await runSql(
          setup.db,
          'INSERT INTO users (name, role, settings, deleted_at) VALUES ($1, $2, $3, $4);',
          ['Transacted User', 'admin', '{}', null]
        );

        const usersBeforeRollback = await queryAll<{ id: number; name: string }>(
          setup.db,
          'SELECT id, name FROM users WHERE role = $1;',
          ['admin']
        );
        expect(usersBeforeRollback).toHaveLength(1);

        await setup.session.executor.rollbackTransaction();
      } catch {
        await setup.session.executor.rollbackTransaction();
        throw new Error('Transaction should not have failed');
      }

      const usersAfterRollback = await queryAll<{ id: number; name: string }>(
        setup.db,
        'SELECT id, name FROM users WHERE role = $1;',
        ['admin']
      );
      expect(usersAfterRollback).toHaveLength(0);
    } finally {
      await stopPgliteServer(setup);
    }
  });
});
