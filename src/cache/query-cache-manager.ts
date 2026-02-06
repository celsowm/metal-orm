import type { 
  CacheProvider, 
  CacheOptions, 
  Duration 
} from './cache-interfaces.js';
import type { CacheStrategy } from './strategies/cache-strategy.js';
import { DefaultCacheStrategy } from './strategies/default-cache-strategy.js';
import { parseDuration } from './duration-utils.js';
import { MemoryCacheAdapter } from './adapters/memory-cache-adapter.js';

/**
 * Gerenciador de cache para queries
 * Responsabilidade única: orquestrar leitura/escrita no cache (SRP)
 */
export class QueryCacheManager {
  constructor(
    private provider: CacheProvider = new MemoryCacheAdapter(),
    private strategy: CacheStrategy = new DefaultCacheStrategy(),
    private defaultTtl: Duration = '1h'
  ) {}

  /**
   * Executa com cache - padrão execute-around
   * @returns Resultado da execução (do cache ou da função)
   */
  async getOrExecute<T>(
    options: CacheOptions,
    executor: () => Promise<T>,
    tenantId?: string | number
  ): Promise<T> {
    const key = this.strategy.generateKey(options.key, tenantId);
    const ttlMs = this.parseDuration(options.ttl ?? this.defaultTtl);

    // Tenta obter do cache
    const cached = await this.provider.get<T>(key);
    if (cached !== undefined) {
      return this.strategy.deserialize(cached);
    }

    // Executa a query
    const result = await executor();

    // Verifica se deve cachear
    if (!this.strategy.shouldCache(result, options)) {
      return result;
    }

    // Serializa e salva no cache
    const serialized = this.strategy.serialize(result);
    await this.provider.set(key, serialized, ttlMs);

    // Registra tags se disponível
    if (options.tags) {
      await this.registerTags(key, options.tags);
    }

    return result;
  }

  /**
   * Invalida uma chave específica
   */
  async invalidateKey(key: string, tenantId?: string | number): Promise<void> {
    const fullKey = this.strategy.generateKey(key, tenantId);
    await this.provider.invalidate(fullKey);
  }

  /**
   * Invalida por tags
   */
  async invalidateTags(tags: string[]): Promise<void> {
    await this.provider.invalidateTags(tags);
  }

  /**
   * Invalida por prefixo (útil para multi-tenancy)
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    await this.provider.invalidatePrefix(prefix);
  }

  /**
   * Limpa todo o cache (cuidado!)
   */
  async clear(): Promise<void> {
    const provider = this.provider as CacheProvider & { clear?: () => void };
    if (typeof provider.clear === 'function') {
      provider.clear();
    } else {
      throw new Error('Cache provider does not support clear operation');
    }
  }

  /**
   * Retorna estatísticas do cache (se disponível)
   */
  getStats(): { size: number; tags: number } | undefined {
    const provider = this.provider as CacheProvider & { getStats?: () => { size: number; tags: number } };
    if (typeof provider.getStats === 'function') {
      return provider.getStats();
    }
    return undefined;
  }

  /**
   * Libera recursos do cache
   */
  async dispose(): Promise<void> {
    await this.provider.dispose?.();
  }

  /**
   * Registra tags para uma chave
   */
  private async registerTags(key: string, tags: string[]): Promise<void> {
    // Se o provider tem suporte nativo a tags
    const provider = this.provider as CacheProvider & { registerTags?: (key: string, tags: string[]) => void };
    if (typeof provider.registerTags === 'function') {
      provider.registerTags(key, tags);
    }
    // Caso contrário, as tags são usadas apenas na invalidação
  }

  /**
   * Converte duração para milissegundos
   */
  private parseDuration(d: Duration): number {
    return parseDuration(d);
  }
}
