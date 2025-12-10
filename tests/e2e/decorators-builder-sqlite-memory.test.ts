import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq, gt } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { SelectQueryBuilder, createColumn } from '../../src/query-builder/select.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  execSql,
  runSql
} from './sqlite-helpers.ts';

@Entity()
class Product {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.decimal(10, 2))
  price!: number;

  @Column(col.varchar(100))
  category!: string;

  @Column(col.int())
  stock!: number;

  @HasMany({
    target: () => OrderItem,
    foreignKey: 'productId'
  })
  orderItems!: HasManyCollection<OrderItem>;
}

@Entity()
class OrderItem {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  productId!: number;

  @Column(col.int())
  quantity!: number;

  @Column(col.decimal(10, 2))
  unitPrice!: number;

  @BelongsTo({
    target: () => Product,
    foreignKey: 'productId'
  })
  product?: Product;
}

describe('SQLite decorator with builder e2e', () => {
  it('combines decorator entities with query builder for complex operations', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      // Bootstrap entities to register decorators
      const tables = bootstrapEntities();
      const productTable = getTableDefFromEntity(Product);
      const orderItemTable = getTableDefFromEntity(OrderItem);

      expect(productTable).toBeDefined();
      expect(orderItemTable).toBeDefined();
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'products' }),
          expect.objectContaining({ name: 'order_items' })
        ])
      );

      // Create tables
      await execSql(
        db,
        `
          CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            stock INTEGER NOT NULL
          );
        `
      );

      await execSql(
        db,
        `
          CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unitPrice REAL NOT NULL
          );
        `
      );

      // Insert test data
      await runSql(
        db,
        'INSERT INTO products (name, price, category, stock) VALUES (?, ?, ?, ?);',
        ['Laptop', 999.99, 'Electronics', 10]
      );

      await runSql(
        db,
        'INSERT INTO products (name, price, category, stock) VALUES (?, ?, ?, ?);',
        ['Smartphone', 699.99, 'Electronics', 25]
      );

      await runSql(
        db,
        'INSERT INTO products (name, price, category, stock) VALUES (?, ?, ?, ?);',
        ['Desk Chair', 199.99, 'Furniture', 15]
      );

      await runSql(
        db,
        'INSERT INTO order_items (productId, quantity, unitPrice) VALUES (?, ?, ?);',
        [1, 2, 999.99]
      );

      await runSql(
        db,
        'INSERT INTO order_items (productId, quantity, unitPrice) VALUES (?, ?, ?);',
        [1, 1, 999.99]
      );

      await runSql(
        db,
        'INSERT INTO order_items (productId, quantity, unitPrice) VALUES (?, ?, ?);',
        [2, 3, 699.99]
      );

      const session = createSqliteSessionFromDb(db);

      // Test 1: Use decorator-based query for specific product
      const productColumns = productTable!.columns;
      const [laptop] = await selectFromEntity(Product)
        .select({
          id: productColumns.id,
          name: productColumns.name,
          price: productColumns.price,
          category: productColumns.category,
          stock: productColumns.stock
        })
        .where(eq(productColumns.name, 'Laptop'))
        .execute(session);

      expect(laptop).toBeDefined();
      expect(laptop!.name).toBe('Laptop');
      expect(laptop!.price).toBe(999.99);
      expect(laptop!.category).toBe('Electronics');
      expect(laptop!.stock).toBe(10);

      // Test 2: Use query builder for complex filtering
      const expensiveProducts = await new SelectQueryBuilder(productTable!)
        .select({
          id: productColumns.id,
          name: productColumns.name,
          price: productColumns.price
        })
        .where(gt(productColumns.price, 500))
        .orderBy(productColumns.price, 'DESC')
        .execute(session);

      expect(expensiveProducts).toHaveLength(2);
      expect(expensiveProducts[0].name).toBe('Laptop');
      expect(expensiveProducts[0].price).toBe(999.99);
      expect(expensiveProducts[1].name).toBe('Smartphone');
      expect(expensiveProducts[1].price).toBe(699.99);

      // Test 3: Use decorator-based query with lazy loading
      const electronics = await selectFromEntity(Product)
        .select({
          id: productColumns.id,
          name: productColumns.name,
          category: productColumns.category
        })
        .includeLazy('orderItems')
        .where(eq(productColumns.category, 'Electronics'))
        .orderBy(productColumns.name)
        .execute(session);

      expect(electronics).toHaveLength(2);

      // Load order items for the first electronic product
      const firstProductOrderItems = await (electronics[0].orderItems as HasManyCollection<OrderItem>).load();
      expect(firstProductOrderItems).toHaveLength(2);
      expect(firstProductOrderItems.map(item => item.quantity)).toEqual([2, 1]);

      // Test 4: Use decorator-based query for all products
      const allProductsQuery = await selectFromEntity(Product)
        .select({
          id: productColumns.id,
          name: productColumns.name,
          stock: productColumns.stock,
          category: productColumns.category
        })
        .orderBy(productColumns.name)
        .execute(session);

      expect(allProductsQuery).toHaveLength(3);
      expect(allProductsQuery.map(p => p.name)).toEqual(['Desk Chair', 'Laptop', 'Smartphone']);

      // Test 5: Use explicit ColumnNode expressions for predicates and ordering
      const categoryColumnNode = createColumn(productTable!.name, 'category');
      const stockColumnNode = createColumn(productTable!.name, 'stock');
      const electronicsOrderedByStock = await selectFromEntity(Product)
        .select({
          id: productColumns.id,
          name: productColumns.name,
          stock: productColumns.stock,
          category: productColumns.category
        })
        .where(eq(categoryColumnNode, 'Electronics'))
        .orderBy(stockColumnNode, 'DESC')
        .execute(session);

      expect(electronicsOrderedByStock).toHaveLength(2);
      expect(electronicsOrderedByStock.map(p => p.name)).toEqual(['Smartphone', 'Laptop']);

    } finally {
      await closeDb(db);
    }
  });
});
