// In a real Node environment: import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Browser-compatible implementation of AsyncLocalStorage
 * Provides a simple in-memory store for browser environments
 * @typeParam T - Type of the stored data
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  /**
   * Executes a callback with the specified store value
   * @param store - Value to store during callback execution
   * @param callback - Function to execute with the store value
   * @returns Result of the callback function
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
   * Gets the currently stored value
   * @returns Current store value or undefined if none exists
   */
  getStore(): T | undefined {
    return this.store;
  }
}
