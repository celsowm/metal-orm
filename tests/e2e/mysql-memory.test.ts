import { describe, expect, it } from 'vitest';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Users } from '../fixtures/schema.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { MySqlSchemaDialect } from '../../src/core/ddl/dialects/mysql-schema-dialect.js';
import {
  stopMysqlServer,
  createMysqlServer,
  runSql
} from './mysql-helpers.ts';

const seedUsers = async (connection: any): Promise<void> => {
  await runSql(
    connection,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES (?, ?, ?, ?);',
    ['Alice', 'admin', '{"layout":"grid"}', null]
  );

  await runSql(
    connection,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES (?, ?, ?, ?);',
    ['Bob', 'user', '{"layout":"stack"}', null]
  );
};

describe('MySQL memory e2e', () => {
  it('executes a SelectQueryBuilder against mysql-memory-server', async () => {
    const setup = await createMysqlServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), Users);
      await seedUsers(setup.connection);

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
      expect(adminUsers[0].settings).toBe('{"layout":"grid"}');

      const allUsers = await new SelectQueryBuilder(Users)
        .select({
          id: Users.columns.id,
          name: Users.columns.name
        })
        .orderBy(Users.columns.id)
        .execute(setup.session);

      expect(allUsers.map(u => u.name)).toEqual(['Alice', 'Bob']);
    } finally {
      await stopMysqlServer(setup);
    }
  });

  it('supports raw column selection without schema columns', async () => {
    const setup = await createMysqlServer();

    try {
      await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), Users);
      await seedUsers(setup.connection);

      const rawBuilder = new SelectQueryBuilder(Users)
        .selectRaw('id', 'name', 'role')
        .where(eq({ table: Users.name, name: 'role' }, 'user'));
      const rawUsers = await rawBuilder.execute(setup.session);

      expect(rawUsers).toHaveLength(1);
      expect(rawUsers[0].name).toBe('Bob');
      expect(rawUsers[0].role).toBe('user');
    } finally {
      await stopMysqlServer(setup);
    }
  });

  it('demonstrates col() function usage for table definition', async () => {
    const setup = await createMysqlServer();

    try {
      const Products = defineTable('products', {
        id: col.primaryKey(col.int()),
        name: col.varchar(255),
        price: col.decimal(10, 2),
        category: col.varchar(100),
        stock: col.int()
      });

      await executeSchemaSqlFor(setup.session.executor, new MySqlSchemaDialect(), Products);

      await runSql(
        setup.connection,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
        ['Laptop', 999.99, 'Electronics', 10]
      );

      await runSql(
        setup.connection,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
        ['Smartphone', 699.99, 'Electronics', 25]
      );

      await runSql(
        setup.connection,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
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
      await stopMysqlServer(setup);
    }
  });
});
