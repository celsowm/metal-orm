import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  runSql
} from './sqlite-helpers.ts';
import { Orm } from '../../src/orm/orm.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { createSqliteExecutorFromDb } from './sqlite-helpers.ts';
import { MemoryCacheAdapter } from '../../src/cache/adapters/memory-cache-adapter.js';
import { KeyvCacheAdapter } from '../../src/cache/adapters/keyv-cache-adapter.js';
import Keyv from 'keyv';

// Entity definitions
@Entity()
class CacheTestUser {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email!: string;

  @Column(col.boolean())
  active!: boolean;
}

// Helper to create ORM with cache
const createOrmWithCache = (db: sqlite3.Database, cacheAdapter: any) => {
  const executor = createSqliteExecutorFromDb(db);
  return new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    },
    cache: {
      provider: cacheAdapter,
      defaultTtl: '1h'
    }
  });
};

describe('Cache E2E with SQLite Memory', () => {
  beforeAll(() => {
    // Bootstrap entities before running tests
    bootstrapEntities();
  });

  describe('With MemoryCacheAdapter', () => {
    let db: sqlite3.Database;
    let orm: Orm;
    let cacheAdapter: MemoryCacheAdapter;
    let userTable: ReturnType<typeof getTableDefFromEntity>;

    beforeAll(async () => {
      db = new sqlite3.Database(':memory:');
      cacheAdapter = new MemoryCacheAdapter();
      orm = createOrmWithCache(db, cacheAdapter);
      
      userTable = getTableDefFromEntity(CacheTestUser);
      
      // Create table
      await executeSchemaSqlFor(
        orm.createSession().executor,
        new SQLiteSchemaDialect(),
        userTable!
      );

      // Insert test data
      await runSql(db, 'INSERT INTO cache_test_users (name, email, active) VALUES (?, ?, ?)', ['John Doe', 'john@example.com', 1]);
      await runSql(db, 'INSERT INTO cache_test_users (name, email, active) VALUES (?, ?, ?)', ['Jane Smith', 'jane@example.com', 1]);
      await runSql(db, 'INSERT INTO cache_test_users (name, email, active) VALUES (?, ?, ?)', ['Bob Wilson', 'bob@example.com', 0]);
    });

    beforeEach(() => {
      cacheAdapter.clear();
    });

    afterAll(async () => {
      await orm.dispose();
      await closeDb(db);
    });

    it('should cache query results with selectFromEntity', async () => {
      const session = orm.createSession();

      // First query - should hit database
      const users1 = await selectFromEntity(CacheTestUser)
        .cache('all_users', '30m')
        .execute(session);

      expect(users1).toHaveLength(3);
      expect(cacheAdapter.getStats().size).toBe(1);

      // Second query - should hit cache
      const users2 = await selectFromEntity(CacheTestUser)
        .cache('all_users', '30m')
        .execute(session);

      expect(users2).toHaveLength(3);
      expect(users2).toEqual(users1);
      expect(cacheAdapter.getStats().size).toBe(1); // Still 1, from cache
    });

    it('should cache with tags and invalidate', async () => {
      const session = orm.createSession();

      // Get user table columns for where clause
      const activeColumn = userTable!.columns.active;

      // Cache with tags
      await selectFromEntity(CacheTestUser)
        .where(eq(activeColumn, true))
        .cache('active_users', '1h', ['users', 'dashboard'])
        .execute(session);

      expect(cacheAdapter.getStats().size).toBe(1);

      // Query from cache
      const cached = await selectFromEntity(CacheTestUser)
        .where(eq(activeColumn, true))
        .cache('active_users', '1h', ['users', 'dashboard'])
        .execute(session);

      expect(cached).toHaveLength(2);

      // Invalidate by tag
      await session.invalidateCacheTags(['users']);
      expect(cacheAdapter.getStats().size).toBe(0);
    });

    it('should work with tenant isolation', async () => {
      const session1 = orm.createSession({ tenantId: 'tenant1' });
      const session2 = orm.createSession({ tenantId: 'tenant2' });

      // Query for tenant1
      const users1 = await selectFromEntity(CacheTestUser)
        .cache('users_list', '1h')
        .execute(session1);

      expect(users1).toHaveLength(3);

      // Query for tenant2 - should be separate cache
      const users2 = await selectFromEntity(CacheTestUser)
        .cache('users_list', '1h')
        .execute(session2);

      expect(users2).toHaveLength(3);

      // Should have 2 entries (one per tenant)
      expect(cacheAdapter.getStats().size).toBe(2);

      // Invalidate only tenant1
      await session1.invalidateCachePrefix('tenant:tenant1:');
      expect(cacheAdapter.getStats().size).toBe(1);
    });

    it('should return entity instances', async () => {
      const session = orm.createSession();

      const users = await selectFromEntity(CacheTestUser)
        .cache('users_cached', '1h')
        .execute(session);

      expect(users[0]).toBeInstanceOf(CacheTestUser);
      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('name');
      expect(users[0]).toHaveProperty('email');
      expect(users[0]).toHaveProperty('active');
    });
  });

  describe('With KeyvCacheAdapter', () => {
    let db: sqlite3.Database;
    let orm: Orm;
    let keyv: Keyv;

    beforeAll(async () => {
      db = new sqlite3.Database(':memory:');
      keyv = new Keyv(); // In-memory store for testing
      const cacheAdapter = new KeyvCacheAdapter(keyv);
      orm = createOrmWithCache(db, cacheAdapter);
      
      const userTable = getTableDefFromEntity(CacheTestUser);
      
      // Create table
      await executeSchemaSqlFor(
        orm.createSession().executor,
        new SQLiteSchemaDialect(),
        userTable!
      );

      // Insert test data
      await runSql(db, 'INSERT INTO cache_test_users (name, email, active) VALUES (?, ?, ?)', ['Alice', 'alice@example.com', 1]);
    });

    afterAll(async () => {
      await orm.dispose();
      await closeDb(db);
    });

    it('should cache with Keyv adapter', async () => {
      const session = orm.createSession();

      // First query
      const users1 = await selectFromEntity(CacheTestUser)
        .cache('keyv_users', '1h')
        .execute(session);

      expect(users1).toHaveLength(1);

      // Verify in Keyv directly
      const cached = await keyv.get('keyv_users');
      expect(cached).toBeDefined();

      // Second query - from cache
      const users2 = await selectFromEntity(CacheTestUser)
        .cache('keyv_users', '1h')
        .execute(session);

      expect(users2).toEqual(users1);
    });

    it('should handle TTL expiration with Keyv', async () => {
      const session = orm.createSession();

      await selectFromEntity(CacheTestUser)
        .cache('short_ttl', 100) // 100ms as number
        .execute(session);

      // Verify cached
      let cached = await keyv.get('short_ttl');
      expect(cached).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      cached = await keyv.get('short_ttl');
      expect(cached).toBeUndefined();
    });
  });
});
