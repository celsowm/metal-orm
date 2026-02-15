import type { CacheProvider } from '../cache-interfaces.js';

// Tipos mínimos para ioredis (para evitar dependência obrigatória)
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<number>;
  scan(cursor: string | number, ...args: (string | number)[]): Promise<[string, string[]]>;
  quit(): Promise<string>;
  disconnect(): void;
  isReady?: boolean;
  status?: string;
}

interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  lazyConnect?: boolean;
  [key: string]: unknown;
}

/**
 * Adapter para Redis usando ioredis
 * 
 * Suporta:
 * - Tags via Redis Sets (SADD, SMEMBERS, SREM)
 * - Prefix invalidation via SCAN
 * - TTL nativo do Redis
 * 
 * Instalação:
 * npm install ioredis
 * 
 * Para testes (dev):
 * npm install --save-dev ioredis-mock
 */
export class RedisCacheAdapter implements CacheProvider {
  readonly name = 'redis';
  readonly capabilities = {
    tags: true,
    prefix: true,
    ttl: true,
  };

  private redis: RedisLike;
  private ownsConnection: boolean;
  private tagPrefix: string;

  /**
   * Cria um adapter Redis
   * 
   * @param redis - Instância do ioredis OU opções de conexão
   * @param options - Opções adicionais
   * @param options.tagPrefix - Prefixo para chaves de tag (default: 'tag:')
   * 
   * Exemplos:
   * 
   * // Com instância existente (recomendado para connection pooling):
   * const redis = new Redis({ host: 'localhost', port: 6379 });
   * const adapter = new RedisCacheAdapter(redis);
   * 
   * // Com opções (adapter gerencia conexão):
   * const adapter = new RedisCacheAdapter({ host: 'localhost', port: 6379 });
   * 
   * // Para testes com ioredis-mock:
   * import Redis from 'ioredis-mock';
   * const adapter = new RedisCacheAdapter(new Redis());
   */
  constructor(
    redis: RedisLike | RedisOptions,
    options?: { tagPrefix?: string }
  ) {
    this.tagPrefix = options?.tagPrefix ?? 'tag:';
    
    if (this.isRedisInstance(redis)) {
      // Recebeu uma instância existente
      this.redis = redis;
      this.ownsConnection = false;
    } else {
      // Recebeu opções, precisa criar a conexão
      this.redis = this.createRedis(redis);
      this.ownsConnection = true;
    }
  }

  private isRedisInstance(obj: unknown): obj is RedisLike {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'get' in obj &&
      'set' in obj &&
      'del' in obj &&
      typeof (obj as RedisLike).get === 'function'
    );
  }

  private createRedis(options: RedisOptions): RedisLike {
    // Dynamic import para evitar dependência obrigatória
    try {
      const Redis = require('ioredis');
      return new Redis(options) as RedisLike;
    } catch {
      throw new Error(
        'ioredis is required for RedisCacheAdapter. ' +
        'Install it with: npm install ioredis'
      );
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.redis.get(key);
    if (value === null) {
      return undefined;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.redis.get(key);
    return value !== null;
  }

  async set<T>(
    key: string,
    value: T,
    ttlMs?: number,
    tags?: string[]
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    
    if (ttlMs) {
      // EX = seconds, PX = milliseconds
      await this.redis.set(key, serialized, 'PX', ttlMs);
    } else {
      await this.redis.set(key, serialized);
    }

    // Registra tags se fornecidas
    if (tags && tags.length > 0) {
      await this.registerTags(key, tags);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidate(key: string): Promise<void> {
    await this.delete(key);
  }

  async invalidateTags(tags: string[]): Promise<void> {
    const keysToDelete = new Set<string>();

    for (const tag of tags) {
      const tagKey = `${this.tagPrefix}${tag}`;
      const keys = await this.redis.smembers(tagKey);
      
      for (const key of keys) {
        keysToDelete.add(key);
      }
      
      // Deleta o set da tag
      await this.redis.del(tagKey);
    }

    // Deleta todas as chaves associadas
    if (keysToDelete.size > 0) {
      await this.redis.del(...Array.from(keysToDelete));
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      // Deleta em batches de 1000 para evitar bloqueio
      const batchSize = 1000;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        await this.redis.del(...batch);
      }
    }
  }

  private async registerTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.tagPrefix}${tag}`;
      await this.redis.sadd(tagKey, key);
    }
  }

  async dispose(): Promise<void> {
    if (this.ownsConnection) {
      try {
        await this.redis.quit();
      } catch {
        // Se quit falhar, tenta disconnect
        this.redis.disconnect?.();
      }
    }
  }

  /**
   * Retorna a instância Redis subjacente
   * Útil para operações avançadas ou health checks
   */
  getRedis(): RedisLike {
    return this.redis;
  }
}
