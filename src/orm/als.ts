// In a real Node environment: import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Browser-compatible implementation of AsyncLocalStorage.
 * Provides a simple in-memory store for browser environments while maintaining
 * Node.js AsyncLocalStorage API compatibility.
 * 
 * @template T Type of the data stored in the async context
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  /**
   * Executes a callback function within a context containing the specified store value.
   * The store value is only available during the callback's execution and is automatically
   * cleared afterward.
   * 
   * @param store - The context value to make available during callback execution
   * @param callback - Function to execute with the store value available
   * @returns Result of the callback function execution
   * 
   * @example
   * ```
   * const als = new AsyncLocalStorage<number>();
   * als.run(42, () => {
   *   console.log(als.getStore()); // Outputs: 42
   * });
   * ```
   */
  run<R>(store: T, callback: () => R): R {
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = undefined;
    }
  }

  /**
   * Retrieves the current store value from the async context.
   * Returns undefined if called outside of a `run()` callback execution.
   * 
   * @returns Current store value or undefined if no context exists
   * 
   * @example
   * ```
   * const als = new AsyncLocalStorage<string>();
   * console.log(als.getStore()); // Outputs: undefined
   * 
   * als.run('hello', () => {
   *   console.log(als.getStore()); // Outputs: 'hello'
   * });
   * ```
   */
  getStore(): T | undefined {
    return this.store;
  }
}
