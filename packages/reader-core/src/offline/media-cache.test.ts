import { describe, expect, it } from 'vitest';
import { MediaCache } from './media-cache.js';
import type { KvStore } from './idb.js';

/** In-memory KvStore — fake-indexeddb + jsdom can't round-trip Blobs reliably. */
function memStore(): KvStore {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    keys: async () => [...m.keys()],
  };
}

const blob = (n: number) => new Blob([new Uint8Array(n)]);

describe('MediaCache', () => {
  it('stores and returns blobs, tracking bytes per book', async () => {
    const cache = new MediaCache({ store: memStore() });
    await cache.putBlob('bk', '0', blob(100), 3);
    await cache.putBlob('bk', '1', blob(50), 3);

    expect((await cache.getBlob('bk', '0'))?.size).toBe(100);
    const meta = await cache.meta('bk');
    expect(meta).toMatchObject({ bytes: 150, pageCount: 3 });
    expect(meta?.slots.sort()).toEqual(['0', '1']);
  });

  it('does not double-count a re-written slot', async () => {
    const cache = new MediaCache({ store: memStore() });
    await cache.putBlob('bk', '0', blob(100));
    await cache.putBlob('bk', '0', blob(100));
    expect((await cache.meta('bk'))?.bytes).toBe(100);
  });

  it('evicts the least-recently-used book past the budget', async () => {
    let clock = 0;
    const cache = new MediaCache({ store: memStore(), budgetBytes: 250, now: () => ++clock });

    await cache.putBlob('a', '0', blob(100));
    await cache.putBlob('b', '0', blob(100));
    await cache.getBlob('a', '0'); // touch a → b is now LRU
    await cache.putBlob('c', '0', blob(100)); // 300 > 250 → evict b

    expect(await cache.meta('b')).toBeUndefined();
    expect(await cache.meta('a')).toBeDefined();
    expect(await cache.meta('c')).toBeDefined();
  });

  it('removeBook drops every slot and the meta', async () => {
    const store = memStore();
    const cache = new MediaCache({ store });
    await cache.putBlob('bk', '0', blob(10));
    await cache.putBlob('bk', 'file', blob(10));
    await cache.removeBook('bk');
    expect(await cache.meta('bk')).toBeUndefined();
    expect(await cache.getBlob('bk', '0')).toBeUndefined();
    expect(await store.keys()).toHaveLength(0);
  });
});
