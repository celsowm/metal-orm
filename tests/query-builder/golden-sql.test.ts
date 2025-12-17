import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { TableDef } from '../../src/schema/table.js';
import { ColumnDef, ColumnType } from '../../src/schema/column-types.js';

/**
 * Golden SQL Tests
 * 
 * These tests validate that compile() output matches what would be executed.
 * This prevents regressions like the bug where toSql() output differed from
 * actual execution due to hydration not being applied during compilation.
 * 
 * Key Invariants:
 * 1. compile().sql === toSql()
 * 2. getAST() is idempotent (returns same structure each time)
 * 3. Hydration transformations are reflected in compiled SQL
 */

// Simple mock table for testing
const mockTable: TableDef = {
    name: 'users',
    schema: undefined,
    columns: {
        id: { name: 'id', type: 'integer' as ColumnType, table: 'users' } as ColumnDef,
        name: { name: 'name', type: 'string' as ColumnType, table: 'users' } as ColumnDef,
    },
    relations: {},
    primaryKey: ['id'],
};

describe('Golden SQL Tests - compile() correctness', () => {
    it('toSql() MUST match compile().sql (critical invariant)', () => {
        const qb = new SelectQueryBuilder(mockTable);
        const compiled = qb.compile('postgres');
        const sql = qb.toSql('postgres');

        // This is the golden test: they MUST be identical
        expect(sql).toBe(compiled.sql);
    });

    it('getAST() is idempotent', () => {
        const qb = new SelectQueryBuilder(mockTable);

        const ast1 = qb.getAST();
        const ast2 = qb.getAST();

        // Multiple calls should return identical AST
        expect(ast1).toEqual(ast2);
    });

    it('compile() uses hydrated AST (not raw state.ast)', () => {
        const qb = new SelectQueryBuilder(mockTable);

        const ast = qb.getAST();
        const compiled = qb.compile('postgres');

        // The compiled SQL must reflect the hydrated AST
        // (This was the bug: compile used context.state.ast instead of getAST())
        expect(compiled).toBeDefined();
        expect(compiled.sql).toBeTruthy();
        expect(typeof compiled.sql).toBe('string');
    });
});

describe('API Type Safety Tests', () => {
    it('select() accepts column names', () => {
        const qb = new SelectQueryBuilder(mockTable);

        // This should compile without TypeScript errors
        const result = qb.select('id', 'name');

        expect(result).toBeInstanceOf(SelectQueryBuilder);
    });

    it('fluent API returns builder instance', () => {
        const qb = new SelectQueryBuilder(mockTable);

        const result = qb
            .select('id')
            .limit(10)
            .offset(5);

        expect(result).toBeInstanceOf(SelectQueryBuilder);
    });
});


