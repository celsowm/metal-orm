import { describe, expect, test } from 'vitest';
import { FunctionRegistry, type FunctionDefinition } from '../../../src/core/functions/function-registry.js';
import { StandardFunctionStrategy } from '../../../src/core/functions/standard-strategy.js';
import type { FunctionRenderContext } from '../../../src/core/functions/types.js';
import type { FunctionNode, OperandNode } from '../../../src/core/ast/expression.js';

const createContext = (name: string, compiledArgs: string[] = []): FunctionRenderContext => ({
    node: { type: 'Function', name, args: [] as OperandNode[] } as FunctionNode,
    compiledArgs,
    compileOperand: () => ''
});

describe('FunctionRegistry', () => {
    test('registers definitions in bulk', () => {
        const registry = new FunctionRegistry();
        const definitions: FunctionDefinition[] = [
            { name: 'ALPHA', renderer: () => 'alpha' },
            { name: 'BETA', renderer: () => 'beta' }
        ];
        registry.register(definitions);

        expect(registry.get('ALPHA')?.(createContext('ALPHA'))).toBe('alpha');
        expect(registry.get('BETA')?.(createContext('BETA'))).toBe('beta');
    });

    test('merge overrides earlier renderers and adds new ones', () => {
        const base = new FunctionRegistry();
        base.add('FOO', () => 'base');

        const overrides = new FunctionRegistry();
        overrides.add('FOO', () => 'overridden');
        overrides.add('BAR', () => 'bar');

        base.merge(overrides);

        expect(base.get('FOO')?.(createContext('FOO'))).toBe('overridden');
        expect(base.get('BAR')?.(createContext('BAR'))).toBe('bar');
    });
});

describe('JSON function validators', () => {
    const strategy = new StandardFunctionStrategy();

    const render = (name: string, compiledArgs: string[]): string => {
        const renderer = strategy.getRenderer(name);
        if (!renderer) {
            throw new Error(`Renderer not found for ${name}`);
        }
        return renderer(createContext(name, compiledArgs));
    };

    test('JSON_LENGTH errors when argument count is invalid', () => {
        expect(() => render('JSON_LENGTH', [])).toThrow('JSON_LENGTH expects 1 or 2 arguments');
        expect(() => render('JSON_LENGTH', ['a', 'b', 'c'])).toThrow('JSON_LENGTH expects 1 or 2 arguments');
        expect(render('JSON_LENGTH', ['doc'])).toBe('JSON_LENGTH(doc)');
    });

    test('JSON_SET requires path/value pairs', () => {
        expect(() => render('JSON_SET', ['doc', '$.value'])).toThrow(
            'JSON_SET expects a JSON document followed by one or more path/value pairs'
        );
    });

    test('JSON_ARRAYAGG enforces a single argument', () => {
        expect(() => render('JSON_ARRAYAGG', ['a', 'b'])).toThrow('JSON_ARRAYAGG expects exactly one argument');
        expect(render('JSON_ARRAYAGG', ['value'])).toBe('JSON_ARRAYAGG(value)');
    });

    test('JSON_CONTAINS expects two or three arguments', () => {
        expect(() => render('JSON_CONTAINS', ['a'])).toThrow('JSON_CONTAINS expects two or three arguments');
        expect(() => render('JSON_CONTAINS', ['a', 'b', 'c', 'd'])).toThrow('JSON_CONTAINS expects two or three arguments');
    });

    test('ARRAY_APPEND expects exactly two arguments', () => {
        expect(() => render('ARRAY_APPEND', ['a'])).toThrow('ARRAY_APPEND expects exactly two arguments');
        expect(() => render('ARRAY_APPEND', ['a', 'b', 'c'])).toThrow('ARRAY_APPEND expects exactly two arguments');
    });
});
