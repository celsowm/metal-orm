import { describe, expect, test } from 'vitest';
import { jsonLength, jsonSet, jsonArrayAgg, jsonContains } from '../../../src/core/functions/json.js';

describe('JSON Function Helpers', () => {
    test('jsonLength creates the proper AST without a path', () => {
        const ast = jsonLength('data');
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_LENGTH',
            fn: 'JSON_LENGTH',
            args: [{ type: 'Literal', value: 'data' }]
        });
    });

    test('jsonLength accepts an optional path argument', () => {
        const ast = jsonLength('data', '$.items');
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_LENGTH',
            fn: 'JSON_LENGTH',
            args: [
                { type: 'Literal', value: 'data' },
                { type: 'Literal', value: '$.items' }
            ]
        });
    });

    test('jsonSet builds the correct AST', () => {
        const ast = jsonSet('data', '$.value', 42);
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_SET',
            fn: 'JSON_SET',
            args: [
                { type: 'Literal', value: 'data' },
                { type: 'Literal', value: '$.value' },
                { type: 'Literal', value: 42 }
            ]
        });
    });

    test('jsonArrayAgg wraps a value in JSON_ARRAYAGG', () => {
        const ast = jsonArrayAgg('value');
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_ARRAYAGG',
            fn: 'JSON_ARRAYAGG',
            args: [{ type: 'Literal', value: 'value' }]
        });
    });

    test('jsonContains defaults to a two-argument call', () => {
        const ast = jsonContains('document', '{"foo":1}');
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_CONTAINS',
            fn: 'JSON_CONTAINS',
            args: [
                { type: 'Literal', value: 'document' },
                { type: 'Literal', value: '{"foo":1}' }
            ]
        });
    });

    test('jsonContains allows an optional path argument', () => {
        const ast = jsonContains('document', '{"foo":1}', '$');
        expect(ast).toEqual({
            type: 'Function',
            name: 'JSON_CONTAINS',
            fn: 'JSON_CONTAINS',
            args: [
                { type: 'Literal', value: 'document' },
                { type: 'Literal', value: '{"foo":1}' },
                { type: 'Literal', value: '$' }
            ]
        });
    });
});
