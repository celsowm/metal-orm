import { describe, it, expect } from 'vitest';
import {
  defineTable,
  col,
  vectorDistance,
  cosineDistance,
  l2Distance,
  innerProduct,
  l1Distance,
  vectorMatch
} from '../../src/index.js';
import {
  PostgresSchemaDialect,
  MSSqlSchemaDialect,
  MySqlSchemaDialect,
  SQLiteSchemaDialect
} from '../../src/core/ddl/dialects/index.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';

describe('Vector Support Across 4 Databases', () => {
  const itemsTable = defineTable('items', {
    id: col.primaryKey(col.int()),
    embedding: col.vector(3),
    half_embedding: col.vector(3, { elementType: 'float16' }),
    hvec: col.halfvec(3)
  });

  describe('DDL Column Type Rendering', () => {
    it('renders vector column types correctly in PostgreSQL (pgvector)', () => {
      const dialect = new PostgresSchemaDialect();
      expect(dialect.renderColumnType(itemsTable.columns.embedding)).toBe('vector(3)');
      expect(dialect.renderColumnType(itemsTable.columns.half_embedding)).toBe('halfvec(3)');
      expect(dialect.renderColumnType(itemsTable.columns.hvec)).toBe('halfvec(3)');
    });

    it('renders vector column types correctly in SQL Server (T-SQL)', () => {
      const dialect = new MSSqlSchemaDialect();
      expect(dialect.renderColumnType(itemsTable.columns.embedding)).toBe('VECTOR(3)');
      expect(dialect.renderColumnType(itemsTable.columns.half_embedding)).toBe('VECTOR(3, float16)');
      expect(dialect.renderColumnType(itemsTable.columns.hvec)).toBe('VECTOR(3, float16)');
    });

    it('renders vector column types correctly in MySQL (8.0.31+)', () => {
      const dialect = new MySqlSchemaDialect();
      expect(dialect.renderColumnType(itemsTable.columns.embedding)).toBe('VECTOR(3)');
      expect(dialect.renderColumnType(itemsTable.columns.half_embedding)).toBe('VECTOR(3)');
      expect(dialect.renderColumnType(itemsTable.columns.hvec)).toBe('VECTOR(3)');
    });

    it('renders vector column types correctly in SQLite (sqlite-vec)', () => {
      const dialect = new SQLiteSchemaDialect();
      expect(dialect.renderColumnType(itemsTable.columns.embedding)).toBe('float32[3]');
      expect(dialect.renderColumnType(itemsTable.columns.half_embedding)).toBe('float16[3]');
      expect(dialect.renderColumnType(itemsTable.columns.hvec)).toBe('float16[3]');
    });
  });

  describe('PostgreSQL pgvector Index Rendering (HNSW and IVFFlat)', () => {
    it('renders HNSW vector index with ops and WITH parameters', () => {
      const dialect = new PostgresSchemaDialect();
      const indexSql = dialect.renderIndex(itemsTable, {
        name: 'idx_items_hnsw',
        columns: ['embedding'],
        using: 'hnsw',
        ops: 'vector_cosine_ops',
        with: { m: 16, ef_construction: 64 }
      });
      expect(indexSql).toBe(
        'CREATE INDEX IF NOT EXISTS "idx_items_hnsw" ON "items" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);'
      );
    });

    it('renders IVFFlat vector index', () => {
      const dialect = new PostgresSchemaDialect();
      const indexSql = dialect.renderIndex(itemsTable, {
        name: 'idx_items_ivfflat',
        columns: ['embedding'],
        using: 'ivfflat',
        ops: 'vector_l2_ops',
        with: { lists: 100 }
      });
      expect(indexSql).toBe(
        'CREATE INDEX IF NOT EXISTS "idx_items_ivfflat" ON "items" USING ivfflat ("embedding" vector_l2_ops) WITH (lists = 100);'
      );
    });
  });

  describe('Query Compilation - Vector Distance Syntax', () => {
    const vecInput = [0.1, 2, 30];

    it('compiles vector distance for PostgreSQL using operators (<=>, <->, <#>, <~>)', () => {
      const dialect = new PostgresDialect();

      const qCosine = new SelectQueryBuilder(itemsTable).select({ dist: cosineDistance(itemsTable.columns.embedding, vecInput) });
      const sqlCosine = qCosine.compile(dialect).sql;
      expect(sqlCosine).toMatch(/\("items"\."embedding" <=> \$\d+\)/);

      const qL2 = new SelectQueryBuilder(itemsTable).select({ dist: l2Distance(itemsTable.columns.embedding, vecInput) });
      const sqlL2 = qL2.compile(dialect).sql;
      expect(sqlL2).toMatch(/\("items"\."embedding" <-> \$\d+\)/);

      const qDot = new SelectQueryBuilder(itemsTable).select({ dist: innerProduct(itemsTable.columns.embedding, vecInput) });
      const sqlDot = qDot.compile(dialect).sql;
      expect(sqlDot).toMatch(/\("items"\."embedding" <#> \$\d+\)/);

      const qL1 = new SelectQueryBuilder(itemsTable).select({ dist: l1Distance(itemsTable.columns.embedding, vecInput) });
      const sqlL1 = qL1.compile(dialect).sql;
      expect(sqlL1).toMatch(/\("items"\."embedding" <~> \$\d+\)/);
    });

    it('compiles vector distance for SQL Server using VECTOR_DISTANCE(...)', () => {
      const dialect = new SqlServerDialect();

      const qCosine = new SelectQueryBuilder(itemsTable).select({ dist: cosineDistance(itemsTable.columns.embedding, vecInput) });
      const sqlCosine = qCosine.compile(dialect).sql;
      expect(sqlCosine).toMatch(/VECTOR_DISTANCE\('cosine', \[items\]\.\[embedding\], @p\d+\)/);

      const qL2 = new SelectQueryBuilder(itemsTable).select({ dist: l2Distance(itemsTable.columns.embedding, vecInput) });
      const sqlL2 = qL2.compile(dialect).sql;
      expect(sqlL2).toMatch(/VECTOR_DISTANCE\('euclidean', \[items\]\.\[embedding\], @p\d+\)/);
    });

    it('compiles vector distance for MySQL using DISTANCE(..., "COSINE")', () => {
      const dialect = new MySqlDialect();

      const qCosine = new SelectQueryBuilder(itemsTable).select({ dist: cosineDistance(itemsTable.columns.embedding, vecInput) });
      const sqlCosine = qCosine.compile(dialect).sql;
      expect(sqlCosine).toContain("DISTANCE(`items`.`embedding`, ?, 'COSINE')");

      const qL2 = new SelectQueryBuilder(itemsTable).select({ dist: l2Distance(itemsTable.columns.embedding, vecInput) });
      const sqlL2 = qL2.compile(dialect).sql;
      expect(sqlL2).toContain("DISTANCE(`items`.`embedding`, ?, 'EUCLIDEAN')");
    });

    it('compiles vector distance for SQLite using vec_distance_cosine / vec_distance_L2', () => {
      const dialect = new SqliteDialect();

      const qCosine = new SelectQueryBuilder(itemsTable).select({ dist: cosineDistance(itemsTable.columns.embedding, vecInput) });
      const sqlCosine = qCosine.compile(dialect).sql;
      expect(sqlCosine).toContain('vec_distance_cosine("items"."embedding", ?)');

      const qL2 = new SelectQueryBuilder(itemsTable).select({ dist: l2Distance(itemsTable.columns.embedding, vecInput) });
      const sqlL2 = qL2.compile(dialect).sql;
      expect(sqlL2).toContain('vec_distance_L2("items"."embedding", ?)');
    });

    it('compiles sqlite-vec KNN virtual table match predicate via vectorMatch', () => {
      const dialect = new SqliteDialect();
      const q = new SelectQueryBuilder(itemsTable)
        .select({ id: itemsTable.columns.id })
        .where(vectorMatch(itemsTable.columns.embedding, vecInput, 5));
      const sql = q.compile(dialect).sql;
      expect(sql).toBe(
        'SELECT "items"."id" AS "id" FROM "items" WHERE "items"."embedding" MATCH ? AND ? = ?;'
      );
    });
  });
});
