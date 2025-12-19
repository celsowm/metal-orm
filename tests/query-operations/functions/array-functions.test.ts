import { describe, expect, test } from 'vitest';
import { arrayAppend } from '../../../src/core/functions/array.js';

describe('Array Function Helpers', () => {
    test('arrayAppend builds the correct AST', () => {
        const ast = arrayAppend('items', 'value');
        expect(ast).toEqual({
            type: 'Function',
            name: 'ARRAY_APPEND',
            fn: 'ARRAY_APPEND',
            args: [
                { type: 'Literal', value: 'items' },
                { type: 'Literal', value: 'value' }
            ]
        });
    });
});
