import { describe, it, expect } from 'vitest';
import { eq, like, collate } from '../../../src/core/ast/expression.js';
import { Users } from '../../fixtures/schema.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';

describe('COLLATE expressions', () => {
    const dialect = new SqliteDialect();

    it('compiles COLLATE in WHERE clause with LIKE', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(like(collate(Users.columns.name, 'Latin1_General_CI_AI'), '%joão%'));

        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."name" COLLATE Latin1_General_CI_AI LIKE ?;'
        );
        expect(compiled.params).toEqual(['%joão%']);
    });

    it('compiles COLLATE in WHERE clause with equality', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(eq(collate(Users.columns.name, 'NOCASE'), 'admin'));

        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."name" COLLATE NOCASE = ?;'
        );
        expect(compiled.params).toEqual(['admin']);
    });

    it('compiles COLLATE with literal as expression', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(eq(collate('foo', 'NOCASE'), 'FOO'));

        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE ? COLLATE NOCASE = ?;'
        );
        expect(compiled.params).toEqual(['foo', 'FOO']);
    });
});
