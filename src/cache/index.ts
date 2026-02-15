// Interfaces
export type {
  CacheReader,
  CacheWriter,
  CacheInvalidator,
  CacheProvider,
  CacheCapabilities,
  Duration,
  CacheOptions,
  InvalidationStrategy,
  CacheState,
} from './cache-interfaces.js';

// Utils
export { parseDuration, formatDuration, isValidDuration } from './duration-utils.js';

// Strategies
export type { CacheStrategy } from './strategies/cache-strategy.js';
export { DefaultCacheStrategy } from './strategies/default-cache-strategy.js';

// Adapters
export { MemoryCacheAdapter } from './adapters/memory-cache-adapter.js';
export { KeyvCacheAdapter } from './adapters/keyv-cache-adapter.js';
export { RedisCacheAdapter } from './adapters/redis-cache-adapter.js';

// Manager
export { QueryCacheManager } from './query-cache-manager.js';

// Tag Index
export { TagIndex } from './tag-index.js';
