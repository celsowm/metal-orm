# Caching

MetalORM includes a powerful, flexible caching system that works seamlessly across all three levels of abstraction. The cache supports multiple backends, human-readable TTL, tag-based invalidation, and multi-tenancy.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Cache Providers](#cache-providers)
  - [Memory Cache (Development)](#memory-cache-development)
  - [Keyv Cache (Production)](#keyv-cache-production)
- [Using Cache in Queries](#using-cache-in-queries)
  - [Basic Caching](#basic-caching)
  - [TTL Formats](#ttl-formats)
  - [Cache with Tags](#cache-with-tags)
- [Invalidation Strategies](#invalidation-strategies)
  - [By Tags](#by-tags)
  - [By Key](#by-key)
  - [By Prefix](#by-prefix)
- [Multi-Tenancy Support](#multi-tenancy-support)
- [Integration with ORM Levels](#integration-with-orm-levels)
  - [Level 1: Query Builder](#level-1-query-builder)
  - [Level 2 & 3: ORM Runtime](#level-2--3-orm-runtime)
- [Best Practices](#best-practices)

## Overview

The caching system in MetalORM follows SOLID principles:

- **Interface Segregation**: Separate interfaces for reading, writing, and invalidation
- **Strategy Pattern**: Pluggable cache backends (Memory, Keyv/Redis, etc.)
- **Zero Dependencies**: Works without external cache servers (using MemoryCacheAdapter)
- **Type-Safe**: Full TypeScript support with proper generics

## Quick Start

```typescript
import { Orm, MemoryCacheAdapter } from 'metal-orm';

// Configure ORM with cache
const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: myExecutorFactory,
  cache: {
    provider: new MemoryCacheAdapter(),
    defaultTtl: '1h'
  }
});

// Use cache in any query
const users = await selectFromEntity(User)
  .cache('active_users', '30m')
  .execute(session);
```

## Cache Providers

### Memory Cache (Development)

The `MemoryCacheAdapter` is perfect for development and testing. It stores data in-memory and supports all caching features including tags and invalidation.

```typescript
import { MemoryCacheAdapter } from 'metal-orm';

const cache = new MemoryCacheAdapter();

const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: myExecutorFactory,
  cache: {
    provider: cache,
    defaultTtl: '1h'
  }
});
```

**Features:**
- Zero external dependencies
- Full tag support
- TTL expiration
- Statistics tracking

### Keyv Cache (Production)

For production, use `KeyvCacheAdapter` with Redis, SQLite, or other Keyv-compatible stores.

```bash
npm install keyv @keyv/redis
```

```typescript
import Keyv from 'keyv';
import { KeyvCacheAdapter } from 'metal-orm';

const keyv = new Keyv('redis://localhost:6379');
const cache = new KeyvCacheAdapter(keyv);

const orm = new Orm({
  dialect: new MySqlDialect(),
  executorFactory: myExecutorFactory,
  cache: {
    provider: cache,
    defaultTtl: '1h'
  }
});
```

**Note**: Keyv adapter has limited support for tag invalidation. Use `MemoryCacheAdapter` or implement a custom provider for full tag support.

## Using Cache in Queries

### Basic Caching

Add `.cache(key, ttl)` to any query:

```typescript
const users = await selectFromEntity(User)
  .where(eq(User.active, true))
  .cache('active_users', '30m')
  .execute(session);
```

The first execution hits the database, subsequent calls return cached data.

### TTL Formats

MetalORM supports human-readable TTL formats:

```typescript
// All these are valid
.cache('key', '30s')   // 30 seconds
.cache('key', '10m')   // 10 minutes
.cache('key', '2h')    // 2 hours
.cache('key', '1d')    // 1 day
.cache('key', '1w')    // 1 week
.cache('key', 60000)   // milliseconds
```

### Cache with Tags

Tags enable grouping cache entries for bulk invalidation:

```typescript
// Cache with tags
const users = await selectFromEntity(User)
  .cache('users_list', '1h', ['users', 'dashboard'])
  .execute(session);

const orders = await selectFromEntity(Order)
  .cache('recent_orders', '30m', ['orders', 'dashboard'])
  .execute(session);

// Later: invalidate all dashboard data
await session.invalidateCacheTags(['dashboard']);
// Both 'users_list' and 'recent_orders' are cleared
```

## Invalidation Strategies

### By Tags

Invalidate all cache entries with specific tags:

```typescript
await session.invalidateCacheTags(['users', 'reports']);
```

### By Key

Invalidate a specific cache key:

```typescript
await session.invalidateCacheKey('active_users');
```

### By Prefix

Useful for multi-tenant applications:

```typescript
// Invalidate all cache for a specific tenant
await session.invalidateCachePrefix('tenant:123:');
```

## Multi-Tenancy Support

Cache integrates seamlessly with multi-tenancy:

```typescript
// Create session with tenant ID
const session = orm.createSession({ tenantId: 'tenant_123' });

// Cache is automatically prefixed
const users = await selectFromEntity(User)
  .cache('users_list', '1h')
  .execute(session);
// Cache key: "tenant:tenant_123:users_list"

// Another tenant has separate cache
const session2 = orm.createSession({ tenantId: 'tenant_456' });
const users2 = await selectFromEntity(User)
  .cache('users_list', '1h')
  .execute(session2);
// Cache key: "tenant:tenant_456:users_list"

// Invalidate only tenant_123's cache
await session.invalidateCachePrefix('tenant:tenant_123:');
```

## Integration with ORM Levels

### Level 1: Query Builder

Works with `selectFrom` and manual query building:

```typescript
const query = selectFrom(users)
  .select('id', 'name')
  .where(eq(users.columns.active, true))
  .cache('active_users', '30m');

const { sql, params } = query.compile(dialect);
// Execute manually with your driver
```

### Level 2 & 3: ORM Runtime

Full integration with `OrmSession`:

```typescript
const session = orm.createSession();

// Works with selectFromEntity
const users = await selectFromEntity(User)
  .include('posts')
  .cache('users_with_posts', '1h', ['users'])
  .execute(session);

// Works with find methods
const user = await session.find(User, 1);
// Note: find() uses its own caching via Identity Map

// Invalidate on data changes
await session.saveGraph(User, { id: 1, name: 'Updated' });
await session.flush();
await session.invalidateCacheTags(['users']);
```

## Best Practices

### 1. Cache Key Naming

Use descriptive, hierarchical keys:

```typescript
// Good
.cache('users:active:page:1', '10m')
.cache('dashboard:stats:2024-01', '1h')

// Avoid
.cache('cache1', '10m')
.cache('data', '1h')
```

### 2. TTL Selection

Choose TTL based on data volatility:

```typescript
// Static data (countries, categories)
.cache('countries', '1d')

// Semi-static (user profiles)
.cache(`user:${userId}:profile`, '1h')

// Dynamic (active sessions)
.cache('active_sessions', '5m')

// Real-time (avoid caching)
// Don't cache
```

### 3. Tag Organization

Create a tagging strategy:

```typescript
// Entity-based tags
cache('users', 'orders', 'products')

// Feature-based tags
cache('dashboard', 'reports', 'api')

// Environment tags
cache('prod', 'staging', 'dev')
```

### 4. Conditional Caching

Cache only when conditions are met:

```typescript
const users = await selectFromEntity(User)
  .cache('users', '1h', {
    condition: (result) => result.length > 0
  })
  .execute(session);
```

### 5. Error Handling

Cache operations are non-blocking:

```typescript
// Cache failures don't break queries
try {
  const users = await selectFromEntity(User)
    .cache('users', '1h')
    .execute(session);
} catch (error) {
  // Query still works even if cache fails
  console.warn('Cache error, falling back to database');
}
```

### 6. Production Checklist

- [ ] Use Redis or similar for production (not MemoryCacheAdapter)
- [ ] Set appropriate TTLs for your data
- [ ] Implement cache warming for critical data
- [ ] Monitor cache hit rates
- [ ] Plan cache invalidation strategy
- [ ] Use multi-tenancy prefixes if applicable

---

See also:
- [Runtime & Unit of Work](./runtime.md) - More on OrmSession
- [Advanced Features](./advanced-features.md) - Multi-tenant filters
- [Tree Behavior](./tree.md) - Tree scoping with tenantId
