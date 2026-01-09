import { describe, it, expect } from 'vitest';
import {
    defineTable,
    col,
    SelectQueryBuilder,
    bitLength,
    octetLength,
    chr,
    hour,
    minute,
    second,
    quarter,
    position,
    locate,
    instr,
    length
} from '../../src/index.js';

describe('Extended SQL Functions Verification', () => {
    const users = defineTable('users', {
        id: col.primaryKey(col.int()),
        name: col.varchar(255),
        created_at: col.datetime()
    });

    const dialects: ('postgres' | 'mysql' | 'sqlite' | 'mssql')[] = ['postgres', 'mysql', 'sqlite', 'mssql'];

    it('compiles new text functions across dialects', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                bl: bitLength(users.columns.name),
                ol: octetLength(users.columns.name),
                c: chr(65)
            });

        dialects.forEach(dialect => {
            const compiled = qb.compile(dialect);
            if (dialect === 'postgres') {
                expect(compiled.sql).toContain('BIT_LENGTH("users"."name")');
                expect(compiled.sql).toContain('OCTET_LENGTH("users"."name")');
                expect(compiled.sql).toContain('CHR($1)');
            } else if (dialect === 'mysql') {
                expect(compiled.sql).toContain('BIT_LENGTH(`users`.`name`)');
                expect(compiled.sql).toContain('OCTET_LENGTH(`users`.`name`)');
                expect(compiled.sql).toContain('CHR(?)');
            } else if (dialect === 'sqlite') {
                expect(compiled.sql).toContain('BIT_LENGTH("users"."name")');
                expect(compiled.sql).toContain('OCTET_LENGTH("users"."name")');
                expect(compiled.sql).toContain('CHAR(?)');
            } else if (dialect === 'mssql') {
                expect(compiled.sql).toContain('BIT_LENGTH([users].[name])');
                expect(compiled.sql).toContain('OCTET_LENGTH([users].[name])');
                expect(compiled.sql).toContain('CHAR(@p1)');
            }
        });
    });

    it('compiles new datetime functions across dialects', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                h: hour(users.columns.created_at),
                m: minute(users.columns.created_at),
                s: second(users.columns.created_at),
                q: quarter(users.columns.created_at)
            });

        dialects.forEach(dialect => {
            const compiled = qb.compile(dialect);
            if (dialect === 'postgres') {
                expect(compiled.sql).toContain('EXTRACT(HOUR FROM "users"."created_at")');
                expect(compiled.sql).toContain('EXTRACT(QUARTER FROM "users"."created_at")');
            } else if (dialect === 'mysql') {
                expect(compiled.sql).toContain('HOUR(`users`.`created_at`)');
                expect(compiled.sql).toContain('QUARTER(`users`.`created_at`)');
            } else if (dialect === 'sqlite') {
                expect(compiled.sql).toContain("strftime('%H', \"users\".\"created_at\")");
                expect(compiled.sql).toContain('((CAST(strftime(\'%m\', "users"."created_at") AS INTEGER) + 2) / 3)');
            } else if (dialect === 'mssql') {
                expect(compiled.sql).toContain('DATEPART(hour, [users].[created_at])');
                expect(compiled.sql).toContain('DATEPART(quarter, [users].[created_at])');
            }
        });
    });

    it('verifies POSITION/LOCATE/INSTR/LENGTH normalization', () => {
        const qb = new SelectQueryBuilder(users)
            .select({
                p: position('A', users.columns.name),
                l: length(users.columns.name)
            });

        dialects.forEach(dialect => {
            const compiled = qb.compile(dialect);
            if (dialect === 'postgres') {
                expect(compiled.sql).toContain('POSITION($1 IN "users"."name")');
                expect(compiled.sql).toContain('LENGTH("users"."name")');
            } else if (dialect === 'mysql') {
                expect(compiled.sql).toContain('POSITION(? IN `users`.`name`)');
                expect(compiled.sql).toContain('LENGTH(`users`.`name`)');
            } else if (dialect === 'sqlite') {
                expect(compiled.sql).toContain('POSITION(? IN "users"."name")');
                expect(compiled.sql).toContain('LENGTH("users"."name")');
            } else if (dialect === 'mssql') {
                expect(compiled.sql).toContain('CHARINDEX(@p1, [users].[name])');
                expect(compiled.sql).toContain('LEN([users].[name])');
            }
        });
    });
});
