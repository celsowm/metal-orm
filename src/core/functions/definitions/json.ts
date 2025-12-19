import type { FunctionDefinition } from '../function-registry.js';

export const jsonFunctionDefinitions: FunctionDefinition[] = [
  {
    name: 'JSON_LENGTH',
    renderer: ({ compiledArgs }) => {
      if (compiledArgs.length === 0 || compiledArgs.length > 2) {
        throw new Error('JSON_LENGTH expects 1 or 2 arguments');
      }
      return `JSON_LENGTH(${compiledArgs.join(', ')})`;
    }
  },
  {
    name: 'JSON_SET',
    renderer: ({ compiledArgs }) => {
      if (compiledArgs.length < 3 || (compiledArgs.length - 1) % 2 !== 0) {
        throw new Error('JSON_SET expects a JSON document followed by one or more path/value pairs');
      }
      return `JSON_SET(${compiledArgs.join(', ')})`;
    }
  },
  {
    name: 'JSON_ARRAYAGG',
    renderer: ({ compiledArgs }) => {
      if (compiledArgs.length !== 1) {
        throw new Error('JSON_ARRAYAGG expects exactly one argument');
      }
      return `JSON_ARRAYAGG(${compiledArgs[0]})`;
    }
  },
  {
    name: 'JSON_CONTAINS',
    renderer: ({ compiledArgs }) => {
      if (compiledArgs.length < 2 || compiledArgs.length > 3) {
        throw new Error('JSON_CONTAINS expects two or three arguments');
      }
      return `JSON_CONTAINS(${compiledArgs.join(', ')})`;
    }
  },
  {
    name: 'ARRAY_APPEND',
    renderer: ({ compiledArgs }) => {
      if (compiledArgs.length !== 2) {
        throw new Error('ARRAY_APPEND expects exactly two arguments');
      }
      return `ARRAY_APPEND(${compiledArgs[0]}, ${compiledArgs[1]})`;
    }
  }
];
