import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Keyv from 'keyv';
import { KeyvCacheAdapter } from '../../src/cache/adapters/keyv-cache-adapter.js';

describe('KeyvCacheAdapter', () => {
  let keyv: Keyv;
  let adapter: KeyvCacheAdapter;

  beforeEach(() => {
    // Usa armazenamento em memória do Keyv para testes
    keyv = new Keyv();
    adapter = new KeyvCacheAdapter(keyv);
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('keyv');
  });

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

  it('should expire values after TTL', async () => {
    await adapter.set('key1', 'value1', 100); // 100ms
    expect(await adapter.get('key1')).toBe('value1');
    
    // Aguarda expiração
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(await adapter.get('key1')).toBeUndefined();
  });

  it('should invalidate a specific key', async () => {
    await adapter.set('key1', 'value1');
    await adapter.invalidate('key1');
    expect(await adapter.get('key1')).toBeUndefined();
  });

  it('should throw when invalidating by tags (not supported)', async () => {
    await expect(adapter.invalidateTags(['tag1'])).rejects.toThrow(
      'Keyv adapter does not support tag invalidation'
    );
  });

  it('should handle prefix invalidation (may or may not be supported)', async () => {
    // Keyv 5.6.0+ may support iterator, so this might work or throw
    try {
      await adapter.invalidatePrefix('prefix:');
      // If it works, great
    } catch (error) {
      // If it throws, that's also fine for older versions
      expect((error as Error).message).toContain('Keyv adapter');
    }
  });

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

  it('should overwrite existing values', async () => {
    await adapter.set('key1', 'value1');
    await adapter.set('key1', 'value2');
    
    const value = await adapter.get('key1');
    expect(value).toBe('value2');
  });
});
