import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity,
  entityRef
} from '../../src/decorators/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { insertInto } from '../../src/query/index.js';
import {
  closeDb,
  createSqliteSessionFromDb
} from '../e2e/sqlite-helpers.js';
import { toPagedResponse, toPagedResponseBuilder, type PagedResponse, type Dto } from '../../src/dto/index.js';

// ============================================================================
// Decorated Entities
// ============================================================================

@Entity()
class Product {
  @PrimaryKey(col.primaryKey(col.autoIncrement(col.int())))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.notNull(col.varchar(100)))
  category!: string;

  @Column(col.notNull(col.decimal(10, 2)))
  price!: number;

  @Column(col.notNull(col.int()))
  stock!: number;

  @Column(col.default(col.boolean(), false))
  published!: boolean;

  @Column(col.default(col.timestamp(), { raw: 'NOW' }))
  createdAt!: string;
}

// Product response DTO (exclude internal fields)
type ProductResponse = Dto<typeof Product, never>;
type ProductsPagedResponse = PagedResponse<ProductResponse>;

// ============================================================================
// Test Suite
// ============================================================================

describe('Enhanced Pagination DTO E2E: Decorated Entities + SQLite + ORM', () => {

  it('should execute paged query and convert to enhanced response', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      // Setup schema
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed 47 products
      const categories = ['Electronics', 'Furniture', 'Clothing', 'Books', 'Sports'];
      const productsToInsert = [];
      for (let i = 1; i <= 47; i++) {
        const category = categories[i % categories.length];
        productsToInsert.push({
          name: `Product ${i}`,
          category,
          price: 10 + (i * 5.5),
          stock: 50 + i % 100,
          published: i % 3 !== 0,
          createdAt: `2024-01-${String(i).padStart(2, '0')}`
        });
      }
      const insertBuilder = insertInto(Product).values(productsToInsert);
      const compiledInsert = insertBuilder.compile(session.dialect);
      await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);

      // Execute paged query with selectFromEntity
      const basic = await selectFromEntity(Product)
        .orderBy(entityRef(Product).id, 'ASC')
        .executePaged(session, { page: 2, pageSize: 10 });

      expect(basic.items).toHaveLength(10);
      expect(basic.totalItems).toBe(47);
      expect(basic.page).toBe(2);
      expect(basic.pageSize).toBe(10);

      // Convert to enhanced pagination response
      const enhanced = toPagedResponse(basic);

      // Verify computed fields
      expect(enhanced.totalPages).toBe(5);
      expect(enhanced.hasNextPage).toBe(true);
      expect(enhanced.hasPrevPage).toBe(true);

      // Verify items are correctly typed
      expect(enhanced.items[0]).toMatchObject({
        id: 11,
        name: 'Product 11',
        category: expect.any(String),
        price: expect.any(Number),
        stock: expect.any(Number),
      });

      // Verify basic fields are preserved
      expect(enhanced.items).toEqual(basic.items);
      expect(enhanced.totalItems).toBe(basic.totalItems);
      expect(enhanced.page).toBe(basic.page);
      expect(enhanced.pageSize).toBe(basic.pageSize);
    } finally {
      await closeDb(db);
    }
  });

  it('should handle first page with enhanced pagination', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed 25 products
      for (let i = 1; i <= 25; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.page).toBe(1);
      expect(enhanced.totalPages).toBe(3);
      expect(enhanced.hasNextPage).toBe(true);
      expect(enhanced.hasPrevPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('should handle last page with enhanced pagination', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed 25 products
      for (let i = 1; i <= 25; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 3, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.items).toHaveLength(5);
      expect(enhanced.totalItems).toBe(25);
      expect(enhanced.page).toBe(3);
      expect(enhanced.totalPages).toBe(3);
      expect(enhanced.hasNextPage).toBe(false);
      expect(enhanced.hasPrevPage).toBe(true);
    } finally {
      await closeDb(db);
    }
  });

  it('should handle single page result', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed only 5 products (fits in one page)
      for (let i = 1; i <= 5; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.items).toHaveLength(5);
      expect(enhanced.totalItems).toBe(5);
      expect(enhanced.page).toBe(1);
      expect(enhanced.totalPages).toBe(1);
      expect(enhanced.hasNextPage).toBe(false);
      expect(enhanced.hasPrevPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('should handle empty result set', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // No data seeded

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.items).toHaveLength(0);
      expect(enhanced.totalItems).toBe(0);
      expect(enhanced.page).toBe(1);
      expect(enhanced.totalPages).toBe(1);
      expect(enhanced.hasNextPage).toBe(false);
      expect(enhanced.hasPrevPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('should work with toPagedResponseBuilder for fixed page size', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed 50 products
      for (let i = 1; i <= 50; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      // Create builder with fixed page size of 25
      const toProductsPagedResponse = toPagedResponseBuilder<ProductResponse>(25);

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 25 });

      const enhanced = toProductsPagedResponse(basic);

      expect(enhanced.items).toHaveLength(25);
      expect(enhanced.totalItems).toBe(50);
      expect(enhanced.page).toBe(1);
      expect(enhanced.totalPages).toBe(2);
      expect(enhanced.hasNextPage).toBe(true);
      expect(enhanced.hasPrevPage).toBe(false);
    } finally {
      await closeDb(db);
    }
  });

  it('should maintain type safety with decorated entities', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed 15 products
      for (let i = 1; i <= 15; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      // Type safety: TypeScript should infer the correct type
      const response: ProductsPagedResponse = enhanced;

      // All productss should have required fields
      for (const products of response.items) {
        expect(products.id).toBeDefined();
        expect(products.name).toBeDefined();
        expect(products.category).toBeDefined();
        expect(products.price).toBeDefined();
        expect(products.stock).toBeDefined();
      }
    } finally {
      await closeDb(db);
    }
  });

  it('should work with ordering and filtering together', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed products with different prices
      for (let i = 1; i <= 30; i++) {
        const price = i * 10;
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price,
          stock: 50 + i,
          published: price > 200,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      // Query with ordering and filtering (published products only)
      const e = entityRef(Product);
      const basic = await selectFromEntity(Product)
        .where(eq(e.published, true))
        .orderBy(e.price, 'DESC')
        .executePaged(session, { page: 1, pageSize: 5 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.items).toHaveLength(5);
      expect((enhanced.items[0] as any).price).toBe(300);
      expect((enhanced.items[4] as any).price).toBe(260);
      expect(enhanced.totalItems).toBeLessThanOrEqual(30);
      expect(enhanced.totalPages).toBeGreaterThan(1);
    } finally {
      await closeDb(db);
    }
  });

  it('should correctly compute totalPages for exact divisions', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const productsTable = getTableDefFromEntity(Product);
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        productsTable!
      );

      // Seed exactly 20 products
      for (let i = 1; i <= 20; i++) {
        const insertBuilder = insertInto(Product).values({
          name: `Product ${i}`,
          category: 'Electronics',
          price: 10 + i * 5,
          stock: 50 + i,
          published: true,
          createdAt: '2024-01-01'
        });
        const compiledInsert = insertBuilder.compile(session.dialect);
        await session.executor.executeSql(compiledInsert.sql, compiledInsert.params);
      }

      const basic = await selectFromEntity(Product)
        .executePaged(session, { page: 1, pageSize: 10 });

      const enhanced = toPagedResponse(basic);

      expect(enhanced.totalPages).toBe(2);
    } finally {
      await closeDb(db);
    }
  });
});
