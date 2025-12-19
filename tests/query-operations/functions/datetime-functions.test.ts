import { describe, expect, test } from 'vitest';
import { now, currentDate, currentTime, utcNow, extract, year, month, day, dateAdd, dateSub, dateDiff, dateFormat, unixTimestamp, fromUnixTime, endOfMonth, dayOfWeek, weekOfYear, dateTrunc } from '../../../src/core/functions/datetime.js';

describe('DateTime Functions', () => {
    test('now function creates proper AST', () => {
        const ast = now();
        expect(ast).toEqual({
            type: 'Function',
            name: 'NOW',
            fn: 'NOW',
            args: []
        });
    });

    test('currentDate function creates proper AST', () => {
        const ast = currentDate();
        expect(ast).toEqual({
            type: 'Function',
            name: 'CURRENT_DATE',
            fn: 'CURRENT_DATE',
            args: []
        });
    });

    test('currentTime function creates proper AST', () => {
        const ast = currentTime();
        expect(ast).toEqual({
            type: 'Function',
            name: 'CURRENT_TIME',
            fn: 'CURRENT_TIME',
            args: []
        });
    });

    test('utcNow function creates proper AST', () => {
        const ast = utcNow();
        expect(ast).toEqual({
            type: 'Function',
            name: 'UTC_NOW',
            fn: 'UTC_NOW',
            args: []
        });
    });

    test('extract function creates proper AST', () => {
        const ast = extract('YEAR', '2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'EXTRACT',
            fn: 'EXTRACT',
            args: [
                { type: 'Literal', value: 'YEAR' },
                { type: 'Literal', value: '2023-01-01' }
            ]
        });
    });

    test('year function creates proper AST', () => {
        const ast = year('2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'YEAR',
            fn: 'YEAR',
            args: [{ type: 'Literal', value: '2023-01-01' }]
        });
    });

    test('month function creates proper AST', () => {
        const ast = month('2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'MONTH',
            fn: 'MONTH',
            args: [{ type: 'Literal', value: '2023-01-01' }]
        });
    });

    test('day function creates proper AST', () => {
        const ast = day('2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DAY',
            fn: 'DAY',
            args: [{ type: 'Literal', value: '2023-01-01' }]
        });
    });

    test('dateAdd function creates proper AST', () => {
        const ast = dateAdd('2023-01-01', 1, 'DAY');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DATE_ADD',
            fn: 'DATE_ADD',
            args: [
                { type: 'Literal', value: '2023-01-01' },
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 'DAY' }
            ]
        });
    });

    test('dateSub function creates proper AST', () => {
        const ast = dateSub('2023-01-01', 1, 'DAY');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DATE_SUB',
            fn: 'DATE_SUB',
            args: [
                { type: 'Literal', value: '2023-01-01' },
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 'DAY' }
            ]
        });
    });

    test('dateDiff function creates proper AST', () => {
        const ast = dateDiff('2023-01-02', '2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DATE_DIFF',
            fn: 'DATE_DIFF',
            args: [
                { type: 'Literal', value: '2023-01-02' },
                { type: 'Literal', value: '2023-01-01' }
            ]
        });
    });

    test('dateFormat function creates proper AST', () => {
        const ast = dateFormat('2023-01-01', '%Y-%m-%d');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DATE_FORMAT',
            fn: 'DATE_FORMAT',
            args: [
                { type: 'Literal', value: '2023-01-01' },
                { type: 'Literal', value: '%Y-%m-%d' }
            ]
        });
    });

    test('unixTimestamp function creates proper AST', () => {
        const ast = unixTimestamp();
        expect(ast).toEqual({
            type: 'Function',
            name: 'UNIX_TIMESTAMP',
            fn: 'UNIX_TIMESTAMP',
            args: []
        });
    });

    test('fromUnixTime function creates proper AST', () => {
        const ast = fromUnixTime(1672531200);
        expect(ast).toEqual({
            type: 'Function',
            name: 'FROM_UNIXTIME',
            fn: 'FROM_UNIXTIME',
            args: [{ type: 'Literal', value: 1672531200 }]
        });
    });

    test('endOfMonth function creates proper AST', () => {
        const ast = endOfMonth('2023-02-15');
        expect(ast).toEqual({
            type: 'Function',
            name: 'END_OF_MONTH',
            fn: 'END_OF_MONTH',
            args: [{ type: 'Literal', value: '2023-02-15' }]
        });
    });

    test('dayOfWeek function creates proper AST', () => {
        const ast = dayOfWeek('2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DAY_OF_WEEK',
            fn: 'DAY_OF_WEEK',
            args: [{ type: 'Literal', value: '2023-01-01' }]
        });
    });

    test('weekOfYear function creates proper AST', () => {
        const ast = weekOfYear('2023-01-01');
        expect(ast).toEqual({
            type: 'Function',
            name: 'WEEK_OF_YEAR',
            fn: 'WEEK_OF_YEAR',
            args: [{ type: 'Literal', value: '2023-01-01' }]
        });
    });

    test('dateTrunc function creates proper AST', () => {
        const ast = dateTrunc('YEAR', '2023-06-15');
        expect(ast).toEqual({
            type: 'Function',
            name: 'DATE_TRUNC',
            fn: 'DATE_TRUNC',
            args: [
                { type: 'Literal', value: 'YEAR' },
                { type: 'Literal', value: '2023-06-15' }
            ]
        });
    });
});
