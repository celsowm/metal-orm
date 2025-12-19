import type { FunctionRenderer } from '../types.js';

/**
 * Simple renderer for functions that take one argument.
 */
export function unaryRenderer(name: string): FunctionRenderer {
  return ({ compiledArgs }) => `${name}(${compiledArgs[0]})`;
}

/**
 * Simple renderer for functions that take two arguments.
 */
export function binaryRenderer(name: string): FunctionRenderer {
  return ({ compiledArgs }) => `${name}(${compiledArgs[0]}, ${compiledArgs[1]})`;
}

/**
 * Renders functions that simply join all provided arguments.
 */
export function variadicRenderer(name: string): FunctionRenderer {
  return ({ compiledArgs }) => `${name}(${compiledArgs.join(', ')})`;
}

/**
 * Renders parameterless functions that always include parentheses.
 */
export function noArgsRenderer(name: string): FunctionRenderer {
  return () => `${name}()`;
}
