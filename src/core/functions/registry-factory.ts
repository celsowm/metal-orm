import type { FunctionRegistry } from './function-registry.js';
import { InMemoryFunctionRegistry } from './function-registry.js';
import { registerTextFunctions } from './text.js';
import { registerNumericFunctions } from './numeric.js';

/**
 * Creates a new function registry pre-populated with built-in functions.
 * Each call returns an isolated instance.
 */
export const createDefaultFunctionRegistry = (): FunctionRegistry => {
  const registry = new InMemoryFunctionRegistry();
  registerTextFunctions(registry);
  registerNumericFunctions(registry);
  return registry;
};
