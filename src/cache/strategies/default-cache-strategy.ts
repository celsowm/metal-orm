import type { CacheStrategy } from './cache-strategy.js';
import type { CacheOptions } from '../cache-interfaces.js';

/**
 * Implementação padrão da estratégia de cache
 * Suporta serialização de Date, BigInt e multi-tenancy
 */
export class DefaultCacheStrategy implements CacheStrategy {
  readonly name = 'default';

  /**
   * Gera chave de cache com prefixo de tenant se houver
   */
  generateKey(queryKey: string, tenantId?: string | number): string {
    if (tenantId !== undefined) {
      return `tenant:${tenantId}:${queryKey}`;
    }
    return queryKey;
  }

  /**
   * Verifica se deve cachear baseado na condição configurada
   */
  shouldCache(result: unknown, options: CacheOptions): boolean {
    if (options.condition) {
      return options.condition(result);
    }
    return true;
  }

  /**
   * Serializa com suporte a tipos especiais
   */
  serialize<T>(data: T): unknown {
    return JSON.stringify(data, (key, value) => {
      // Serializa Date
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      
      // Serializa BigInt
      if (typeof value === 'bigint') {
        return { __type: 'BigInt', value: value.toString() };
      }
      
      // Serializa Map
      if (value instanceof Map) {
        return { __type: 'Map', value: Array.from(value.entries()) };
      }
      
      // Serializa Set
      if (value instanceof Set) {
        return { __type: 'Set', value: Array.from(value) };
      }
      
      return value;
    });
  }

  /**
   * Desserializa restaurando tipos especiais
   */
  deserialize<T>(data: unknown): T {
    if (typeof data !== 'string') {
      return data as T;
    }

    return JSON.parse(data, (key, value) => {
      if (!value || typeof value !== 'object') {
        return value;
      }

      // Restaura Date
      if (value.__type === 'Date') {
        return new Date(value.value);
      }
      
      // Restaura BigInt
      if (value.__type === 'BigInt') {
        return BigInt(value.value);
      }
      
      // Restaura Map
      if (value.__type === 'Map') {
        return new Map(value.value);
      }
      
      // Restaura Set
      if (value.__type === 'Set') {
        return new Set(value.value);
      }
      
      return value;
    }) as T;
  }
}
