import { describe, expect, test } from 'vitest';
import { abs, acos, asin, atan, atan2, ceil, ceiling, cos, cot, degrees, exp, floor, ln, log, log10, logBase, mod, pi, power, pow, radians, random, rand, round, sign, sin, sqrt, tan, trunc, truncate } from '../src/core/functions/numeric.js';

describe('Numeric Functions', () => {
    test('abs function creates proper AST', () => {
        const ast = abs(-5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ABS',
            fn: 'ABS',
            args: [{ type: 'Literal', value: -5 }]
        });
    });

    test('acos function creates proper AST', () => {
        const ast = acos(0.5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ACOS',
            fn: 'ACOS',
            args: [{ type: 'Literal', value: 0.5 }]
        });
    });

    test('asin function creates proper AST', () => {
        const ast = asin(0.5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ASIN',
            fn: 'ASIN',
            args: [{ type: 'Literal', value: 0.5 }]
        });
    });

    test('atan function creates proper AST', () => {
        const ast = atan(1);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ATAN',
            fn: 'ATAN',
            args: [{ type: 'Literal', value: 1 }]
        });
    });

    test('atan2 function creates proper AST', () => {
        const ast = atan2(1, 2);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ATAN2',
            fn: 'ATAN2',
            args: [
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 2 }
            ]
        });
    });

    test('ceil function creates proper AST', () => {
        const ast = ceil(5.3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'CEIL',
            fn: 'CEIL',
            args: [{ type: 'Literal', value: 5.3 }]
        });
    });

    test('ceiling function creates proper AST', () => {
        const ast = ceiling(5.3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'CEILING',
            fn: 'CEILING',
            args: [{ type: 'Literal', value: 5.3 }]
        });
    });

    test('cos function creates proper AST', () => {
        const ast = cos(0);
        expect(ast).toEqual({
            type: 'Function',
            name: 'COS',
            fn: 'COS',
            args: [{ type: 'Literal', value: 0 }]
        });
    });

    test('cot function creates proper AST', () => {
        const ast = cot(1);
        expect(ast).toEqual({
            type: 'Function',
            name: 'COT',
            fn: 'COT',
            args: [{ type: 'Literal', value: 1 }]
        });
    });

    test('degrees function creates proper AST', () => {
        const ast = degrees(Math.PI);
        expect(ast).toEqual({
            type: 'Function',
            name: 'DEGREES',
            fn: 'DEGREES',
            args: [{ type: 'Literal', value: Math.PI }]
        });
    });

    test('exp function creates proper AST', () => {
        const ast = exp(1);
        expect(ast).toEqual({
            type: 'Function',
            name: 'EXP',
            fn: 'EXP',
            args: [{ type: 'Literal', value: 1 }]
        });
    });

    test('floor function creates proper AST', () => {
        const ast = floor(5.7);
        expect(ast).toEqual({
            type: 'Function',
            name: 'FLOOR',
            fn: 'FLOOR',
            args: [{ type: 'Literal', value: 5.7 }]
        });
    });

    test('ln function creates proper AST', () => {
        const ast = ln(Math.E);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LN',
            fn: 'LN',
            args: [{ type: 'Literal', value: Math.E }]
        });
    });

    test('log function creates proper AST', () => {
        const ast = log(100);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOG',
            fn: 'LOG',
            args: [{ type: 'Literal', value: 100 }]
        });
    });

    test('log10 function creates proper AST', () => {
        const ast = log10(100);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOG10',
            fn: 'LOG10',
            args: [{ type: 'Literal', value: 100 }]
        });
    });

    test('logBase function creates proper AST', () => {
        const ast = logBase(2, 8);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOG_BASE',
            fn: 'LOG_BASE',
            args: [
                { type: 'Literal', value: 2 },
                { type: 'Literal', value: 8 }
            ]
        });
    });

    test('mod function creates proper AST', () => {
        const ast = mod(10, 3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'MOD',
            fn: 'MOD',
            args: [
                { type: 'Literal', value: 10 },
                { type: 'Literal', value: 3 }
            ]
        });
    });

    test('pi function creates proper AST', () => {
        const ast = pi();
        expect(ast).toEqual({
            type: 'Function',
            name: 'PI',
            fn: 'PI',
            args: []
        });
    });

    test('power function creates proper AST', () => {
        const ast = power(2, 3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'POWER',
            fn: 'POWER',
            args: [
                { type: 'Literal', value: 2 },
                { type: 'Literal', value: 3 }
            ]
        });
    });

    test('pow function creates proper AST', () => {
        const ast = pow(2, 3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'POW',
            fn: 'POW',
            args: [
                { type: 'Literal', value: 2 },
                { type: 'Literal', value: 3 }
            ]
        });
    });

    test('radians function creates proper AST', () => {
        const ast = radians(180);
        expect(ast).toEqual({
            type: 'Function',
            name: 'RADIANS',
            fn: 'RADIANS',
            args: [{ type: 'Literal', value: 180 }]
        });
    });

    test('random function creates proper AST', () => {
        const ast = random();
        expect(ast).toEqual({
            type: 'Function',
            name: 'RANDOM',
            fn: 'RANDOM',
            args: []
        });
    });

    test('rand function creates proper AST', () => {
        const ast = rand();
        expect(ast).toEqual({
            type: 'Function',
            name: 'RAND',
            fn: 'RAND',
            args: []
        });
    });

    test('round function creates proper AST', () => {
        const ast = round(5.678, 2);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ROUND',
            fn: 'ROUND',
            args: [
                { type: 'Literal', value: 5.678 },
                { type: 'Literal', value: 2 }
            ]
        });
    });

    test('round without decimals creates proper AST', () => {
        const ast = round(5.678);
        expect(ast).toEqual({
            type: 'Function',
            name: 'ROUND',
            fn: 'ROUND',
            args: [{ type: 'Literal', value: 5.678 }]
        });
    });

    test('sign function creates proper AST', () => {
        const ast = sign(-5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'SIGN',
            fn: 'SIGN',
            args: [{ type: 'Literal', value: -5 }]
        });
    });

    test('sin function creates proper AST', () => {
        const ast = sin(0);
        expect(ast).toEqual({
            type: 'Function',
            name: 'SIN',
            fn: 'SIN',
            args: [{ type: 'Literal', value: 0 }]
        });
    });

    test('sqrt function creates proper AST', () => {
        const ast = sqrt(25);
        expect(ast).toEqual({
            type: 'Function',
            name: 'SQRT',
            fn: 'SQRT',
            args: [{ type: 'Literal', value: 25 }]
        });
    });

    test('tan function creates proper AST', () => {
        const ast = tan(0);
        expect(ast).toEqual({
            type: 'Function',
            name: 'TAN',
            fn: 'TAN',
            args: [{ type: 'Literal', value: 0 }]
        });
    });

    test('trunc function creates proper AST', () => {
        const ast = trunc(5.678, 2);
        expect(ast).toEqual({
            type: 'Function',
            name: 'TRUNC',
            fn: 'TRUNC',
            args: [
                { type: 'Literal', value: 5.678 },
                { type: 'Literal', value: 2 }
            ]
        });
    });

    test('trunc without decimals creates proper AST', () => {
        const ast = trunc(5.678);
        expect(ast).toEqual({
            type: 'Function',
            name: 'TRUNC',
            fn: 'TRUNC',
            args: [{ type: 'Literal', value: 5.678 }]
        });
    });

    test('truncate function creates proper AST', () => {
        const ast = truncate(5.678, 2);
        expect(ast).toEqual({
            type: 'Function',
            name: 'TRUNCATE',
            fn: 'TRUNCATE',
            args: [
                { type: 'Literal', value: 5.678 },
                { type: 'Literal', value: 2 }
            ]
        });
    });
});
