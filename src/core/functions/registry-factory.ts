import type { FunctionRegistry } from './function-registry.js';
import { InMemoryFunctionRegistry } from './function-registry.js';
import { registerTextFunctions } from './text.js';

/**
 * Creates a new function registry pre-populated with built-in functions.
 * Each call returns an isolated instance.
 */
export const createDefaultFunctionRegistry = (): FunctionRegistry => {
  const registry = new InMemoryFunctionRegistry();
  registerTextFunctions(registry);
  return registry;
};
