import { describe, expect, test } from 'vitest';
import { lower, upper, ascii, char, charLength, length, trim, ltrim, rtrim, concat, concatWs, substr, left, right, position, instr, locate, replace, repeat, lpad, rpad, space } from '../../../src/core/functions/text.js';

describe('Text Functions', () => {
    test('lower function creates proper AST', () => {
        const ast = lower('HELLO');
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOWER',
            fn: 'LOWER',
            args: [{ type: 'Literal', value: 'HELLO' }]
        });
    });

    test('upper function creates proper AST', () => {
        const ast = upper('world');
        expect(ast).toEqual({
            type: 'Function',
            name: 'UPPER',
            fn: 'UPPER',
            args: [{ type: 'Literal', value: 'world' }]
        });
    });

    test('ascii function creates proper AST', () => {
        const ast = ascii('A');
        expect(ast).toEqual({
            type: 'Function',
            name: 'ASCII',
            fn: 'ASCII',
            args: [{ type: 'Literal', value: 'A' }]
        });
    });

    test('char function creates proper AST', () => {
        const ast = char(65, 66, 67);
        expect(ast).toEqual({
            type: 'Function',
            name: 'CHAR',
            fn: 'CHAR',
            args: [
                { type: 'Literal', value: 65 },
                { type: 'Literal', value: 66 },
                { type: 'Literal', value: 67 }
            ]
        });
    });

    test('charLength function creates proper AST', () => {
        const ast = charLength('Hello World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'CHAR_LENGTH',
            fn: 'CHAR_LENGTH',
            args: [{ type: 'Literal', value: 'Hello World' }]
        });
    });

    test('length function creates proper AST', () => {
        const ast = length('Hello World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'LENGTH',
            fn: 'LENGTH',
            args: [{ type: 'Literal', value: 'Hello World' }]
        });
    });

    test('trim function creates proper AST', () => {
        const ast = trim('  hello  ');
        expect(ast).toEqual({
            type: 'Function',
            name: 'TRIM',
            fn: 'TRIM',
            args: [{ type: 'Literal', value: '  hello  ' }]
        });
    });

    test('trim with chars function creates proper AST', () => {
        const ast = trim('xyzhelloxyz', 'xyz');
        expect(ast).toEqual({
            type: 'Function',
            name: 'TRIM',
            fn: 'TRIM',
            args: [
                { type: 'Literal', value: 'xyzhelloxyz' },
                { type: 'Literal', value: 'xyz' }
            ]
        });
    });

    test('ltrim function creates proper AST', () => {
        const ast = ltrim('  hello ');
        expect(ast).toEqual({
            type: 'Function',
            name: 'LTRIM',
            fn: 'LTRIM',
            args: [{ type: 'Literal', value: '  hello ' }]
        });
    });

    test('rtrim function creates proper AST', () => {
        const ast = rtrim('  hello  ');
        expect(ast).toEqual({
            type: 'Function',
            name: 'RTRIM',
            fn: 'RTRIM',
            args: [{ type: 'Literal', value: '  hello  ' }]
        });
    });

    test('concat function creates proper AST', () => {
        const ast = concat('Hello', ' ', 'World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'CONCAT',
            fn: 'CONCAT',
            args: [
                { type: 'Literal', value: 'Hello' },
                { type: 'Literal', value: ' ' },
                { type: 'Literal', value: 'World' }
            ]
        });
    });

    test('concatWs function creates proper AST', () => {
        const ast = concatWs('-', 'Hello', 'World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'CONCAT_WS',
            fn: 'CONCAT_WS',
            args: [
                { type: 'Literal', value: '-' },
                { type: 'Literal', value: 'Hello' },
                { type: 'Literal', value: 'World' }
            ]
        });
    });

    test('substr function creates proper AST', () => {
        const ast = substr('Hello World', 1, 5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'SUBSTR',
            fn: 'SUBSTR',
            args: [
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 5 }
            ]
        });
    });

    test('left function creates proper AST', () => {
        const ast = left('Hello World', 5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LEFT',
            fn: 'LEFT',
            args: [
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 5 }
            ]
        });
    });

    test('right function creates proper AST', () => {
        const ast = right('Hello World', 5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'RIGHT',
            fn: 'RIGHT',
            args: [
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 5 }
            ]
        });
    });

    test('position function creates proper AST', () => {
        const ast = position('World', 'Hello World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'POSITION',
            fn: 'POSITION',
            args: [
                { type: 'Literal', value: 'World' },
                { type: 'Literal', value: 'Hello World' }
            ]
        });
    });

    test('instr function creates proper AST', () => {
        const ast = instr('Hello World', 'World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'INSTR',
            fn: 'INSTR',
            args: [
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 'World' }
            ]
        });
    });

    test('locate function creates proper AST', () => {
        const ast = locate('World', 'Hello World');
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOCATE',
            fn: 'LOCATE',
            args: [
                { type: 'Literal', value: 'World' },
                { type: 'Literal', value: 'Hello World' }
            ]
        });
    });

    test('locate with start function creates proper AST', () => {
        const ast = locate('World', 'Hello World', 1);
        expect(ast).toEqual({
            type: 'Function',
            name: 'LOCATE',
            fn: 'LOCATE',
            args: [
                { type: 'Literal', value: 'World' },
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 1 }
            ]
        });
    });

    test('replace function creates proper AST', () => {
        const ast = replace('Hello World', 'World', 'Universe');
        expect(ast).toEqual({
            type: 'Function',
            name: 'REPLACE',
            fn: 'REPLACE',
            args: [
                { type: 'Literal', value: 'Hello World' },
                { type: 'Literal', value: 'World' },
                { type: 'Literal', value: 'Universe' }
            ]
        });
    });

    test('repeat function creates proper AST', () => {
        const ast = repeat('Hi', 3);
        expect(ast).toEqual({
            type: 'Function',
            name: 'REPEAT',
            fn: 'REPEAT',
            args: [
                { type: 'Literal', value: 'Hi' },
                { type: 'Literal', value: 3 }
            ]
        });
    });

    test('lpad function creates proper AST', () => {
        const ast = lpad('Hello', 10, 'xy');
        expect(ast).toEqual({
            type: 'Function',
            name: 'LPAD',
            fn: 'LPAD',
            args: [
                { type: 'Literal', value: 'Hello' },
                { type: 'Literal', value: 10 },
                { type: 'Literal', value: 'xy' }
            ]
        });
    });

    test('rpad function creates proper AST', () => {
        const ast = rpad('Hello', 10, 'xy');
        expect(ast).toEqual({
            type: 'Function',
            name: 'RPAD',
            fn: 'RPAD',
            args: [
                { type: 'Literal', value: 'Hello' },
                { type: 'Literal', value: 10 },
                { type: 'Literal', value: 'xy' }
            ]
        });
    });

    test('space function creates proper AST', () => {
        const ast = space(5);
        expect(ast).toEqual({
            type: 'Function',
            name: 'SPACE',
            fn: 'SPACE',
            args: [{ type: 'Literal', value: 5 }]
        });
    });
});
