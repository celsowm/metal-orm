// In a real Node environment: import { AsyncLocalStorage } from 'node:async_hooks';

// Browser Shim
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, callback: () => R): R {
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = undefined;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}
