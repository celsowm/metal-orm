import { describe, it, expect } from 'vitest';
import { like, notLike } from '../src/ast/expression';
import { Users } from '../src/playground/features/playground/data/schema';
import { SqliteDialect } from '../src/dialect/sqlite';
import { SelectQueryBuilder } from '../src/builder/select';

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
