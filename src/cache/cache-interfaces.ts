/**
 * Interfaces segregadas para cache (ISP - Interface Segregation Principle)
 */

/**
 * Leitura de cache - pode ser implementada por read-replicas
 */
export interface CacheReader {
  get<T>(key: string): Promise<T | undefined>;
  has(key: string): Promise<boolean>;
}

/**
 * Escrita em cache - pode ser implementada por write-nodes
 */
export interface CacheWriter {
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Invalidação em massa - separada pois nem todo cache suporta tags
 */
export interface CacheInvalidator {
  invalidate(key: string): Promise<void>;
  invalidateTags(tags: string[]): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}

/**
 * Capabilities de um cache provider
 * Permite detectar funcionalidades suportadas em runtime
 */
export interface CacheCapabilities {
  tags: boolean;
  prefix: boolean;
  ttl: boolean;
}

/**
 * Interface completa para implementações full-featured
 */
export interface CacheProvider extends CacheReader, CacheWriter, CacheInvalidator {
  readonly name: string;
  readonly capabilities: CacheCapabilities;
  dispose?(): Promise<void>;
}

/**
 * TTL human-readable: '1d', '2h', '30m', '15s', '1w'
 * Ou número em milissegundos
 */
export type Duration = number | `${number}${'s'|'m'|'h'|'d'|'w'}`;

/**
 * Opções de cache para uma query
 */
export interface CacheOptions {
  key: string;
  ttl: Duration;
  tags?: string[];
  autoInvalidate?: boolean;
  condition?: (result: unknown) => boolean;
}

/**
 * Estratégias de invalidação disponíveis
 */
export type InvalidationStrategy = 
  | 'tags'
  | 'entity'
  | 'prefix'
  | 'key'
  | 'ttl';

/**
 * Estado interno do cache no query builder
 */
export interface CacheState {
  options?: CacheOptions;
}
