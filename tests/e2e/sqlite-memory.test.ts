import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Users } from '../fixtures/schema.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

const seedUsers = async (db: sqlite3.Database): Promise<void> => {
  await runSql(
    db,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES (?, ?, ?, ?);',
    ['Alice', 'admin', '{"layout":"grid"}', null]
  );

  await runSql(
    db,
    'INSERT INTO users (name, role, settings, deleted_at) VALUES (?, ?, ?, ?);',
    ['Bob', 'user', '{"layout":"stack"}', null]
  );
};

describe('SQLite memory e2e', () => {
  it('executes a SelectQueryBuilder against sqlite3.in-memory', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Users);
      await seedUsers(db);

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
        .execute(session);

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
        .execute(session);

      expect(allUsers.map(u => u.name)).toEqual(['Alice', 'Bob']);
    } finally {
      await closeDb(db);
    }
  });

  it('supports raw column selection without schema columns', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Users);
      await seedUsers(db);

      const rawBuilder = new SelectQueryBuilder(Users)
        .selectRaw('id', 'name', 'role')
        .where(eq({ table: Users.name, name: 'role' }, 'user'));
      const rawUsers = await rawBuilder.execute(session);

      expect(rawUsers).toHaveLength(1);
      expect(rawUsers[0].name).toBe('Bob');
      expect(rawUsers[0].role).toBe('user');
    } finally {
      await closeDb(db);
    }
  });

  it('demonstrates col() function usage for table definition', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      // Define table schema using col() function
      const Products = defineTable('products', {
        id: col.primaryKey(col.int()),
        name: col.varchar(255),
        price: col.decimal(10, 2),
        category: col.varchar(100),
        stock: col.int()
      });

      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Products);

      // Insert test data
      await runSql(
        db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
        ['Laptop', 999.99, 'Electronics', 10]
      );

      await runSql(
        db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
        ['Smartphone', 699.99, 'Electronics', 25]
      );

      await runSql(
        db,
        `INSERT INTO ${Products.name} (name, price, category, stock) VALUES (?, ?, ?, ?);`,
        ['Desk Chair', 199.99, 'Furniture', 15]
      );

      // First, let's test if we can query all products
      const allProducts = await new SelectQueryBuilder(Products)
        .select({
          id: Products.columns.id,
          name: Products.columns.name,
          category: Products.columns.category,
          stock: Products.columns.stock
        })
        .orderBy(Products.columns.name)
        .execute(session);

      expect(allProducts).toHaveLength(3);
      expect(allProducts.map(p => p.name)).toEqual(['Desk Chair', 'Laptop', 'Smartphone']);

      // Query using the defined schema for electronics only
      const electronics = await new SelectQueryBuilder(Products)
        .select({
          id: Products.columns.id,
          name: Products.columns.name,
          price: Products.columns.price,
          category: Products.columns.category
        })
        .where(eq({ table: Products.name, name: 'category' }, 'Electronics'))
        .orderBy(Products.columns.id)
        .execute(session);

      expect(electronics).toHaveLength(2);
      expect(electronics[0].name).toBe('Laptop');
      expect(electronics[0].category).toBe('Electronics');
      expect(electronics[1].name).toBe('Smartphone');
      expect(electronics[1].category).toBe('Electronics');
    } finally {
      await closeDb(db);
    }
  });
});


