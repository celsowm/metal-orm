import type { CacheOptions } from '../cache-interfaces.js';

/**
 * Estratégia de cache - define como chaves são geradas,
 * dados são serializados/desserializados e se devem ser cacheados
 */
export interface CacheStrategy {
  readonly name: string;
  
  /**
   * Gera chave de cache considerando tenant
   */
  generateKey(queryKey: string, tenantId?: string | number): string;
  
  /**
   * Decide se o resultado deve ser cacheado
   */
  shouldCache(result: unknown, options: CacheOptions): boolean;
  
  /**
   * Serializa dados para armazenamento
   */
  serialize<T>(data: T): unknown;
  
  /**
   * Desserializa dados do cache
   */
  deserialize<T>(data: unknown): T;
}
