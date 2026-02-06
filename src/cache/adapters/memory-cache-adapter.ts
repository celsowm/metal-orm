import type { CacheProvider } from '../cache-interfaces.js';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Implementação em memória do cache provider
 * Útil para testes e ambientes de desenvolvimento
 */
export class MemoryCacheAdapter implements CacheProvider {
  readonly name = 'memory';
  private storage: Map<string, CacheEntry<unknown>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.storage.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Verifica expiração
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    this.storage.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
    // Remove do índice de tags
    for (const [tag, keys] of this.tagIndex) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async invalidateTags(tags: string[]): Promise<void> {
    const keysToDelete = new Set<string>();

    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
        this.tagIndex.delete(tag);
      }
    }

    for (const key of keysToDelete) {
      this.storage.delete(key);
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  /**
   * Registra uma chave com tags (para invalidação)
   */
  registerTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.storage.clear();
    this.tagIndex.clear();
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats(): { size: number; tags: number } {
    return {
      size: this.storage.size,
      tags: this.tagIndex.size,
    };
  }

  async dispose(): Promise<void> {
    this.clear();
  }
}
