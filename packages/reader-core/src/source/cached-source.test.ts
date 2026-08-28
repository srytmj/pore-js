import { describe, expect, it, vi } from 'vitest';
import { CachedSource } from './cached-source.js';
import type { KvStore } from '../offline/idb.js';
import type { Position, ReaderSource } from '../index.js';

function memStore(): KvStore {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    keys: async () => [...m.keys()],
  };
}

function innerSource(overrides: Partial<ReaderSource> = {}): ReaderSource {
  return {
    getManifest: vi.fn(
      async () =>
        ({
          bookId: 'b',
          type: 'image',
          title: 't',
          direction: 'ltr',
          pageCount: 0,
          pages: [],
        }) as const,
    ),
    getPage: vi.fn(async () => new Blob()),
    getFile: vi.fn(async () => new Blob()),
    loadProgress: vi.fn(async () => null),
    saveProgress: vi.fn(async () => {}),
    ...overrides,
  };
}

const POS: Position = { type: 'page', value: 5, total: 20 };

describe('CachedSource', () => {
  it('saves locally and mirrors to the inner source', async () => {
    const inner = innerSource();
    const store = memStore();
    const src = new CachedSource(inner, { store });
    await src.saveProgress('b', POS);
    expect(await store.get('pore:progress:b')).toEqual(POS);
    expect(inner.saveProgress).toHaveBeenCalledWith('b', POS);
  });

  it('prefers the local copy on load', async () => {
    const inner = innerSource({
      loadProgress: vi.fn(async () => ({ type: 'page', value: 0, total: 20 }) as Position),
    });
    const store = memStore();
    await store.set('pore:progress:b', POS);
    const src = new CachedSource(inner, { store });
    expect(await src.loadProgress('b')).toEqual(POS);
    expect(inner.loadProgress).not.toHaveBeenCalled();
  });

  it('falls back to the inner source when nothing is cached', async () => {
    const inner = innerSource({ loadProgress: vi.fn(async () => POS) });
    const src = new CachedSource(inner, { store: memStore() });
    expect(await src.loadProgress('b')).toEqual(POS);
  });

  it('queues a failed mirror write and flushes it later', async () => {
    let online = false;
    const inner = innerSource({
      saveProgress: vi.fn(async () => {
        if (!online) throw new Error('offline');
      }),
    });
    const src = new CachedSource(inner, { store: memStore() });
    await src.saveProgress('b', POS);
    expect(src.pendingWrites).toBe(1);

    online = true;
    await src.flush();
    expect(src.pendingWrites).toBe(0);
    expect(inner.saveProgress).toHaveBeenLastCalledWith('b', POS);
  });

  it('collapses multiple queued writes per book to the latest', async () => {
    const inner = innerSource({
      saveProgress: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const src = new CachedSource(inner, { store: memStore() });
    await src.saveProgress('b', { type: 'page', value: 1, total: 20 });
    await src.saveProgress('b', { type: 'page', value: 2, total: 20 });
    await src.saveProgress('b', POS);
    expect(src.pendingWrites).toBe(1);
  });

  it('passes manifest/page/file straight through', async () => {
    const inner = innerSource();
    const src = new CachedSource(inner, { store: memStore() });
    await src.getManifest('b');
    await src.getPage('b', 0);
    expect(inner.getManifest).toHaveBeenCalled();
    expect(inner.getPage).toHaveBeenCalled();
  });
});
