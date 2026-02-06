import type { CacheProvider } from '../cache-interfaces.js';

/**
 * Interface mínima para Keyv
 * Usa unknown para permitir diferentes versões do Keyv
 */
interface KeyvInstance {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean | void>;
  delete(key: string): Promise<boolean>;
  iterator?: unknown;
  disconnect?(): Promise<void>;
}

/**
 * Adapter para Keyv (Redis, SQLite, etc.)
 * Keyv deve ser instalado separadamente:
 * npm install keyv @keyv/redis
 */
export class KeyvCacheAdapter implements CacheProvider {
  readonly name = 'keyv';

  constructor(private keyv: KeyvInstance) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.keyv.get(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.keyv.get(key);
    return value !== undefined;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.keyv.set(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.keyv.delete(key);
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async invalidateTags(_tags: string[]): Promise<void> {
    // Keyv não suporta invalidação por tags nativamente
    // Para suporte completo, usar RedisTagProvider
    throw new Error(
      'Keyv adapter does not support tag invalidation. ' +
      'Use MemoryCacheAdapter for testing or implement a custom Redis provider.'
    );
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    // Tenta usar iterador se disponível (Redis)
    if (typeof this.keyv.iterator === 'function') {
      const keys: string[] = [];
      for await (const [key] of this.keyv.iterator()) {
        if (key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      
      if (keys.length > 0) {
        await Promise.all(keys.map(k => this.keyv.delete(k)));
      }
      return;
    }

    // Fallback: não suportado
    throw new Error(
      'Keyv adapter does not support prefix invalidation in this store. ' +
      'Consider using a store with iterator support.'
    );
  }

  async dispose(): Promise<void> {
    await this.keyv.disconnect?.();
  }
}
