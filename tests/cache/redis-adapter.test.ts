import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisCacheAdapter } from '../../src/cache/adapters/redis-cache-adapter.js';

describe('RedisCacheAdapter', () => {
  let redis: unknown;
  let adapter: RedisCacheAdapter;

  beforeEach(async () => {
    // Dynamic import to avoid TypeScript issues with ioredis-mock types
    const RedisMock = await import('ioredis-mock');
    // Usa ioredis-mock para testes sem necessidade de servidor Redis real
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis = new (RedisMock as any).default();
    adapter = new RedisCacheAdapter(redis as any);
  });

  afterEach(async () => {
    await adapter.dispose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (redis as any).flushall();
  });

  describe('Capabilities', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('redis');
    });

    it('should report full capabilities', () => {
      expect(adapter.capabilities).toEqual({
        tags: true,
        prefix: true,
        ttl: true,
      });
    });
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      await adapter.set('key1', 'value1');
      const value = await adapter.get('key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent key', async () => {
      const value = await adapter.get('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await adapter.set('key1', 'value1');
      expect(await adapter.has('key1')).toBe(true);
      expect(await adapter.has('nonexistent')).toBe(false);
    });

    it('should delete values', async () => {
      await adapter.set('key1', 'value1');
      await adapter.delete('key1');
      expect(await adapter.get('key1')).toBeUndefined();
    });

    it('should invalidate a specific key', async () => {
      await adapter.set('key1', 'value1');
      await adapter.invalidate('key1');
      expect(await adapter.get('key1')).toBeUndefined();
    });
  });

  describe('TTL Support', () => {
    it('should expire values after TTL', async () => {
      await adapter.set('key1', 'value1', 100); // 100ms
      expect(await adapter.get('key1')).toBe('value1');
      
      // Aguarda expiração
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await adapter.get('key1')).toBeUndefined();
    });

    it('should persist values without TTL', async () => {
      await adapter.set('key1', 'value1');
      
      // Aguarda um tempo e verifica se ainda existe
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(await adapter.get('key1')).toBe('value1');
    });
  });

  describe('Tag Invalidation', () => {
    it('should invalidate by single tag', async () => {
      await adapter.set('key1', 'value1', undefined, ['tag1']);
      await adapter.set('key2', 'value2', undefined, ['tag1']);
      await adapter.set('key3', 'value3', undefined, ['tag2']);

      await adapter.invalidateTags(['tag1']);

      expect(await adapter.get('key1')).toBeUndefined();
      expect(await adapter.get('key2')).toBeUndefined();
      expect(await adapter.get('key3')).toBe('value3'); // Não foi invalidado
    });

    it('should invalidate by multiple tags', async () => {
      await adapter.set('key1', 'value1', undefined, ['tag1']);
      await adapter.set('key2', 'value2', undefined, ['tag2']);
      await adapter.set('key3', 'value3', undefined, ['tag3']);

      await adapter.invalidateTags(['tag1', 'tag2']);

      expect(await adapter.get('key1')).toBeUndefined();
      expect(await adapter.get('key2')).toBeUndefined();
      expect(await adapter.get('key3')).toBe('value3');
    });

    it('should handle multiple tags per key', async () => {
      await adapter.set('key1', 'value1', undefined, ['tag1', 'tag2']);
      await adapter.set('key2', 'value2', undefined, ['tag2', 'tag3']);

      await adapter.invalidateTags(['tag2']);

      expect(await adapter.get('key1')).toBeUndefined();
      expect(await adapter.get('key2')).toBeUndefined();
    });

    it('should not throw when invalidating non-existent tags', async () => {
      await expect(adapter.invalidateTags(['nonexistent'])).resolves.not.toThrow();
    });
  });

  describe('Prefix Invalidation', () => {
    it('should invalidate by prefix', async () => {
      await adapter.set('users:1', 'user1');
      await adapter.set('users:2', 'user2');
      await adapter.set('posts:1', 'post1');

      await adapter.invalidatePrefix('users:');

      expect(await adapter.get('users:1')).toBeUndefined();
      expect(await adapter.get('users:2')).toBeUndefined();
      expect(await adapter.get('posts:1')).toBe('post1'); // Não foi invalidado
    });

    it('should handle empty prefix gracefully', async () => {
      await adapter.set('key1', 'value1');
      
      // Invalidar prefixo vazio deve deletar tudo
      await adapter.invalidatePrefix('');
      
      expect(await adapter.get('key1')).toBeUndefined();
    });

    it('should not throw when no keys match prefix', async () => {
      await expect(adapter.invalidatePrefix('nonexistent:')).resolves.not.toThrow();
    });
  });

  describe('Complex Data Types', () => {
    it('should handle complex objects', async () => {
      const data = {
        id: 1,
        name: 'Test',
        nested: {
          value: 123,
          items: [1, 2, 3]
        }
      };

      await adapter.set('complex', data);
      const cached = await adapter.get<typeof data>('complex');
      
      expect(cached).toEqual(data);
    });

    it('should handle arrays', async () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      await adapter.set('array', data);
      const cached = await adapter.get<typeof data>('array');
      
      expect(cached).toEqual(data);
    });

    it('should handle null values', async () => {
      await adapter.set('null-key', null);
      const cached = await adapter.get('null-key');
      expect(cached).toBeNull();
    });

    it('should handle boolean values', async () => {
      await adapter.set('bool-true', true);
      await adapter.set('bool-false', false);
      
      expect(await adapter.get('bool-true')).toBe(true);
      expect(await adapter.get('bool-false')).toBe(false);
    });

    it('should handle numbers', async () => {
      await adapter.set('number', 42);
      const cached = await adapter.get('number');
      expect(cached).toBe(42);
    });
  });

  describe('Edge Cases', () => {
    it('should overwrite existing values', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key1', 'value2');
      
      const value = await adapter.get('key1');
      expect(value).toBe('value2');
    });

    it('should handle special characters in keys', async () => {
      const key = 'special:key:with:colons';
      await adapter.set(key, 'value');
      expect(await adapter.get(key)).toBe('value');
    });

    it('should handle empty string values', async () => {
      await adapter.set('empty', '');
      expect(await adapter.get('empty')).toBe('');
    });

    it('should expose underlying redis instance', () => {
      const underlying = adapter.getRedis();
      expect(underlying).toBe(redis);
    });
  });

  describe('Connection Options', () => {
    it('should accept RedisOptions and create connection', async () => {
      // Este teste verifica que o adapter pode criar uma conexão
      // quando recebe opções em vez de uma instância
      // Nota: Não podemos realmente testar isso com ioredis-mock
      // sem configurar um mock global, então apenas verificamos
      // que o código não quebra
      const testAdapter = new RedisCacheAdapter({ 
        host: 'localhost', 
        port: 6379,
        lazyConnect: true 
      });
      
      // Deve ter criado uma instância interna
      expect(testAdapter.getRedis()).toBeDefined();
      
      await testAdapter.dispose();
    });

    it('should not disconnect when using external instance', async () => {
      // O adapter não deve chamar quit/disconnect quando
      // recebe uma instância externa
      const RedisMock = await import('ioredis-mock');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const externalRedis = new (RedisMock as any).default();
      const externalAdapter = new RedisCacheAdapter(externalRedis as any);
      
      await externalAdapter.dispose();
      
      // O redis externo ainda deve estar "conectado" (no mock)
      expect(await externalRedis.ping()).toBe('PONG');
    });
  });
});
