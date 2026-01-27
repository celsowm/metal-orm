import { describe, it, expect, expectTypeOf } from 'vitest';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column-types.js';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { gt } from '../src/core/ast/expression.js';

/**
 * Tests for partial column selection with automatic type inference.
 * 
 * Goal: When using .select('id', 'nome'), the return type should automatically
 * be Pick<Entity, 'id' | 'nome'>[] without requiring manual casting.
 * 
 * Inspired by:
 * - Prisma: { select: { id: true, name: true } } → { id: number, name: string }[]
 * - Drizzle: db.select({ id: users.id, name: users.name }) → { id: number, name: string }[]
 */
describe('Partial Select Type Inference', () => {
  const users = defineTable('users', {
    id: col.primaryKey(col.int()),
    nome: col.varchar(255),
    email: col.varchar(255),
    age: col.int(),
    createdAt: col.timestamp()
  });

  type UserRow = {
    id: number;
    nome: string;
    email: string;
    age: number;
    createdAt: Date;
  };

  describe('compile-time type inference', () => {
    it('should infer Pick<T, K> when selecting specific columns', () => {
      const qb = new SelectQueryBuilder(users).select('id', 'nome');

      // The return type of select('id', 'nome') should narrow to { id, nome }
      // This is a compile-time check - if types are wrong, TypeScript will error
      type ResultType = typeof qb extends SelectQueryBuilder<infer R, any> ? R : never;
      
      // These should compile without errors
      expectTypeOf<ResultType>().toExtend<{ id: number; nome: string }>();
    });

    it('should infer single column type correctly', () => {
      const qb = new SelectQueryBuilder(users).select('email');

      type ResultType = typeof qb extends SelectQueryBuilder<infer R, any> ? R : never;
      
      expectTypeOf<ResultType>().toExtend<{ email: string }>();
    });

    it('should infer multiple columns correctly', () => {
      const qb = new SelectQueryBuilder(users).select('id', 'nome', 'age');

      type ResultType = typeof qb extends SelectQueryBuilder<infer R, any> ? R : never;
      
      expectTypeOf<ResultType>().toExtend<{ id: number; nome: string; age: number }>();
    });

    it('should preserve type through chained methods', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id', 'nome')
        .orderBy(users.columns.nome, 'ASC')
        .limit(10);

      type ResultType = typeof qb extends SelectQueryBuilder<infer R, any> ? R : never;
      
      expectTypeOf<ResultType>().toExtend<{ id: number; nome: string }>();
    });

    it('should work with object-based select (aliased columns)', () => {
      const qb = new SelectQueryBuilder(users).select({
        id: users.columns.id,
        fullName: users.columns.nome
      });

      type ResultType = typeof qb extends SelectQueryBuilder<infer R, any> ? R : never;
      
      expectTypeOf<ResultType>().toExtend<{ id: number; fullName: string }>();
    });
  });

  describe('SQL generation', () => {
    it('should generate SELECT with only specified columns', () => {
      const qb = new SelectQueryBuilder(users).select('id', 'nome');
      const sql = qb.toSql('postgres');

      expect(sql).toContain('SELECT');
      expect(sql).toContain('"id"');
      expect(sql).toContain('"nome"');
      expect(sql).not.toContain('"email"');
      expect(sql).not.toContain('"age"');
      expect(sql).not.toContain('"createdAt"');
    });

    it('should handle single column selection', () => {
      const qb = new SelectQueryBuilder(users).select('email');
      const sql = qb.toSql('postgres');

      expect(sql).toContain('"email"');
      expect(sql).not.toContain('"id"');
      expect(sql).not.toContain('"nome"');
    });

    it('should combine select with where clause', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id', 'nome')
        .where(gt(users.columns.age, 18));
      
      const sql = qb.toSql('postgres');

      expect(sql).toContain('SELECT');
      expect(sql).toContain('"id"');
      expect(sql).toContain('"nome"');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('"age" >'); // value is parameterized as $1
    });
  });

  describe('chaining behavior', () => {
    it('should allow orderBy after select', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id', 'nome')
        .orderBy(users.columns.nome, 'ASC');

      const sql = qb.toSql('postgres');
      expect(sql).toContain('ORDER BY');
    });

    it('should allow limit after select', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id', 'nome')
        .limit(10);

      const sql = qb.toSql('postgres');
      expect(sql).toContain('LIMIT');
    });

    it('should allow multiple select calls (last one wins or merges)', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id')
        .select('nome');

      const sql = qb.toSql('postgres');
      // Behavior TBD: does it merge or replace?
      expect(sql).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw for non-existent columns', () => {
      expect(() => {
        new SelectQueryBuilder(users).select('nonExistent' as any);
      }).toThrow(/Column 'nonExistent' not found/);
    });
  });

  describe('edge cases', () => {
    it('should handle all columns selected explicitly', () => {
      const qb = new SelectQueryBuilder(users)
        .select('id', 'nome', 'email', 'age', 'createdAt');

      const sql = qb.toSql('postgres');
      
      expect(sql).toContain('"id"');
      expect(sql).toContain('"nome"');
      expect(sql).toContain('"email"');
      expect(sql).toContain('"age"');
      expect(sql).toContain('"createdAt"');
    });

    it('should handle distinct with partial select', () => {
      const qb = new SelectQueryBuilder(users)
        .select('nome')
        .distinct(users.columns.nome);

      const sql = qb.toSql('postgres');
      expect(sql).toContain('DISTINCT');
    });
  });
});

/**
 * executePlain returns the narrowed type based on select() columns
 */
describe('executePlain return type inference', () => {
  const users = defineTable('users', {
    id: col.primaryKey(col.int()),
    nome: col.varchar(255),
    email: col.varchar(255),
    age: col.int(),
  });

  it('executePlain should return narrowed type based on select()', () => {
    const qb = new SelectQueryBuilder(users).select('id', 'nome');

    // Verify the executePlain return type is Promise<T[]> where T = { id: number; nome: string }
    type ExecutePlainReturn = ReturnType<typeof qb.executePlain>;
    type UnwrappedArray = Awaited<ExecutePlainReturn>;
    type ElementType = UnwrappedArray extends (infer E)[] ? E : never;

    expectTypeOf<ElementType>().toExtend<{ id: number; nome: string }>();
    // Should NOT include other columns
    expectTypeOf<ElementType>().not.toExtend<{ email: string }>();
  });

  it('executePlain should infer single column correctly', () => {
    const qb = new SelectQueryBuilder(users).select('email');

    type ExecutePlainReturn = ReturnType<typeof qb.executePlain>;
    type UnwrappedArray = Awaited<ExecutePlainReturn>;
    type ElementType = UnwrappedArray extends (infer E)[] ? E : never;

    expectTypeOf<ElementType>().toExtend<{ email: string }>();
  });

  it('executePlain should preserve type through chained methods', () => {
    const qb = new SelectQueryBuilder(users)
      .select('id', 'age')
      .orderBy(users.columns.age, 'DESC')
      .limit(10);

    type ExecutePlainReturn = ReturnType<typeof qb.executePlain>;
    type UnwrappedArray = Awaited<ExecutePlainReturn>;
    type ElementType = UnwrappedArray extends (infer E)[] ? E : never;

    expectTypeOf<ElementType>().toExtend<{ id: number; age: number }>();
  });

  it('executePlain should work with object-based select (aliased columns)', () => {
    const qb = new SelectQueryBuilder(users).select({
      identifier: users.columns.id,
      fullName: users.columns.nome
    });

    type ExecutePlainReturn = ReturnType<typeof qb.executePlain>;
    type UnwrappedArray = Awaited<ExecutePlainReturn>;
    type ElementType = UnwrappedArray extends (infer E)[] ? E : never;

    expectTypeOf<ElementType>().toExtend<{ identifier: number; fullName: string }>();
  });

  it('pluck should work with partial select', () => {
    const qb = new SelectQueryBuilder(users).select('id', 'nome');

    // pluck should only accept keys that are in the selected columns
    type PluckParam = Parameters<typeof qb.pluck>[0];
    
    expectTypeOf<'id'>().toExtend<PluckParam>();
    expectTypeOf<'nome'>().toExtend<PluckParam>();
  });
});
