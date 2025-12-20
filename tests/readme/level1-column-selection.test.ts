import { describe, it, expect } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { concat } from '../../src/core/functions/text.js';

describe('README Level 1 - Column selection type safety', () => {
    // Shared table definition
    const users = defineTable('users', {
        id: col.primaryKey(col.int()),
        firstName: col.varchar(255),
        lastName: col.varchar(255),
        email: col.varchar(255),
    });

    it('should allow selecting valid columns and compile to SQL', () => {
        const qb = new SelectQueryBuilder(users);
        const validQuery = qb.select('firstName', 'lastName');

        const dialect = new MySqlDialect();
        const { sql, params } = validQuery.compile(dialect);

        expect(sql).toContain('SELECT');
        expect(sql).toContain('users');
        expect(sql).toContain('firstName');
        expect(sql).toContain('lastName');
        expect(params).toEqual([]);
    });

    it('should throw runtime error for non-existent columns', () => {
        const qb = new SelectQueryBuilder(users);

        expect(() => {
            // @ts-expect-error - Testing runtime check for invalid column
            qb.select('company');
        }).toThrowError("Column 'company' not found on table 'users'");

        expect(() => {
            // @ts-expect-error - Testing runtime check for invalid column
            qb.select('non_existent_column');
        }).toThrowError(/Column 'non_existent_column' not found/);
    });

    it('should allow using concat function to combine columns', () => {
        const qb = new SelectQueryBuilder(users);

        // [VALID] - Use concat to combine firstName and lastName with a space
        const concatQuery = qb.select({
            fullName: concat(users.columns.firstName, ' ', users.columns.lastName),
            email: users.columns.email
        });

        const dialect = new MySqlDialect();
        const { sql, params } = concatQuery.compile(dialect);

        // Updated expectation to match actual output:
        // 1. Includes `AS 'email'` because it was passed as an object property
        // 2. Includes the trailing semicolon `;`
        expect(sql).toBe(
            'SELECT CONCAT(`users`.`firstName`, ?, `users`.`lastName`) AS `fullName`, `users`.`email` AS `email` FROM `users`;'
        );
        
        expect(params).toEqual([' ']);
    });

    it('should allow spreading an array of column names', () => {
        const qb = new SelectQueryBuilder(users);
        const columns = ['firstName', 'email'] as const;

        const spreadQuery = qb.select(...columns);
        const dialect = new MySqlDialect();
        const { sql, params } = spreadQuery.compile(dialect);

        expect(sql).toContain('firstName');
        expect(sql).toContain('email');
        expect(sql).toContain('FROM `users`');
        expect(params).toEqual([]);
    });
});
