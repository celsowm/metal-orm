import { describe, it, expect } from 'vitest';
import { defineTable, col, SelectQueryBuilder, coalesce, ifNull, nullif, greatest, least, age, localTime, log2, reverse, md5, stddev } from '../../src/index.js';

describe('New SQL Functions', () => {
    const users = defineTable('users', {
        id: col.primaryKey(col.int()),
        name: col.varchar(255),
        created_at: col.datetime(),
        score: col.int()
    });

    it('compiles control flow functions', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                c: coalesce(users.columns.name, 'Unknown'),
                i: ifNull(users.columns.name, 'Unknown'),
                n: nullif(users.columns.name, ''),
                g: greatest(users.columns.score, 10),
                l: least(users.columns.score, 100)
            });

        const compiled = qb.compile('postgres');
        expect(compiled.sql).toContain('COALESCE("users"."name", $1)');
        expect(compiled.sql).not.toContain('IFNULL');
        expect(compiled.sql).toContain('NULLIF("users"."name", $3)');
        expect(compiled.sql).toContain('GREATEST("users"."score", $4)');
        expect(compiled.sql).toContain('LEAST("users"."score", $5)');
    });

    it('compiles datetime functions', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                a: age(users.columns.created_at),
                t: localTime()
            });

        const compiled = qb.compile('postgres');
        expect(compiled.sql).toContain('AGE("users"."created_at")');
        expect(compiled.sql).toContain('LOCALTIME');
    });

    it('compiles numeric functions', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                l: log2(users.columns.score)
            });

        const compiled = qb.compile('postgres');
        expect(compiled.sql).toContain('LOG2("users"."score")');
    });

    it('compiles text functions', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                r: reverse(users.columns.name),
                m: md5(users.columns.name)
            });

        const compiled = qb.compile('postgres');
        expect(compiled.sql).toContain('REVERSE("users"."name")');
        expect(compiled.sql).toContain('MD5("users"."name")');
    });

    it('compiles aggregate functions', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                s: stddev(users.columns.score)
            });

        const compiled = qb.compile('postgres');
        expect(compiled.sql).toContain('STDDEV("users"."score")');
    });
});
