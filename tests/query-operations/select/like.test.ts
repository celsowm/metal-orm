import { describe, it, expect } from 'vitest';
import { like, notLike } from '../../../src/core/ast/expression.js';
import { Users } from '../../fixtures/schema.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';

describe('like expressions', () => {
    const dialect = new SqliteDialect();

    it('compiles LIKE with an escape clause', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(like(Users.columns.name, 'Admin\\_%', '\\'));

        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."name" LIKE ? ESCAPE ?;'
        );
        expect(compiled.params).toEqual(['Admin\\_%', '\\']);
    });

    it('compiles NOT LIKE with an escape clause', () => {
        const q = new SelectQueryBuilder(Users)
            .selectRaw('*')
            .where(notLike(Users.columns.role, 'admin\\_%', '\\'));

        const compiled = q.compile(dialect);
        expect(compiled.sql).toBe(
            'SELECT "users"."*" FROM "users" WHERE "users"."role" NOT LIKE ? ESCAPE ?;'
        );
        expect(compiled.params).toEqual(['admin\\_%', '\\']);
    });
});
