import type { FunctionRenderer } from './types.js';

/**
 * Definition for a SQL function renderer.
 */
export interface FunctionDefinition {
  name: string;
  renderer: FunctionRenderer;
}

/**
 * Registry that keeps track of function renderers and exposes them by name.
 */
export class FunctionRegistry {
  private readonly renderers: Map<string, FunctionRenderer> = new Map();

  /**
   * Registers or overrides a renderer for the given function name.
   */
  add(name: string, renderer: FunctionRenderer): void {
    this.renderers.set(name, renderer);
  }

  /**
   * Registers a batch of definitions.
   */
  register(definitions: Iterable<FunctionDefinition>): void {
    for (const definition of definitions) {
      this.add(definition.name, definition.renderer);
    }
  }

  /**
   * Merges another registry into this one, allowing overrides from the other source.
   */
  merge(other: FunctionRegistry): void {
    for (const [name, renderer] of other.renderers.entries()) {
      this.renderers.set(name, renderer);
    }
  }

  /**
   * Retrieves a renderer by function name.
   */
  get(name: string): FunctionRenderer | undefined {
    return this.renderers.get(name);
  }
}
