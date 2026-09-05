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
    const src = new CachedSource(inner, { store, cache: false });
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
    const src = new CachedSource(inner, { store, cache: false });
    expect(await src.loadProgress('b')).toEqual(POS);
    expect(inner.loadProgress).not.toHaveBeenCalled();
  });

  it('falls back to the inner source when nothing is cached', async () => {
    const inner = innerSource({ loadProgress: vi.fn(async () => POS) });
    const src = new CachedSource(inner, { store: memStore(), cache: false });
    expect(await src.loadProgress('b')).toEqual(POS);
  });

  it('queues a failed mirror write and flushes it later', async () => {
    let online = false;
    const inner = innerSource({
      saveProgress: vi.fn(async () => {
        if (!online) throw new Error('offline');
      }),
    });
    const src = new CachedSource(inner, { store: memStore(), cache: false });
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
    const src = new CachedSource(inner, { store: memStore(), cache: false });
    await src.saveProgress('b', { type: 'page', value: 1, total: 20 });
    await src.saveProgress('b', { type: 'page', value: 2, total: 20 });
    await src.saveProgress('b', POS);
    expect(src.pendingWrites).toBe(1);
  });

  it('falls back to the manifest saved by download() when the inner source is offline', async () => {
    let online = true;
    const inner = innerSource({
      getManifest: vi.fn(async () => {
        if (!online) throw new Error('offline');
        return {
          bookId: 'b',
          type: 'image' as const,
          title: 'Offline Book',
          direction: 'ltr' as const,
          pageCount: 2,
          pages: [{ index: 0 }, { index: 1 }],
        };
      }),
      getPage: vi.fn(async (_b: string, i: number) => new Blob([new Uint8Array([i])])),
    });
    const src = new CachedSource(inner, { store: memStore(), cache: { store: memStore() } });
    await src.download('b'); // caches pages + persists the manifest

    online = false;
    const offlineManifest = await src.getManifest('b');
    expect(offlineManifest).toMatchObject({ title: 'Offline Book', pageCount: 2 });
  });

  it('re-throws when the inner source fails and nothing was ever cached', async () => {
    const inner = innerSource({
      getManifest: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const src = new CachedSource(inner, { store: memStore(), cache: false });
    await expect(src.getManifest('b')).rejects.toThrow(/offline/);
  });

  it('saves highlights locally and mirrors to the inner source', async () => {
    const saveHighlights = vi.fn(async () => {});
    const inner = innerSource({ saveHighlights });
    const store = memStore();
    const src = new CachedSource(inner, { store, cache: false });
    const hls = [
      {
        id: 'h1',
        range: { spine: 0, startBlock: 0, startOffset: 0, endBlock: 0, endOffset: 5 },
        cfi: { start: 'epubcfi(/6/2!/2:0)', end: 'epubcfi(/6/2!/2:5)' },
        color: 'yellow',
        text: 'hello',
        createdAt: 1,
      },
    ];
    await src.saveHighlights('b', hls);
    expect(await store.get('pore:highlights:b')).toEqual(hls);
    expect(saveHighlights).toHaveBeenCalledWith('b', hls);
  });

  it('prefers the local highlights copy on load, falling back to the inner source', async () => {
    const loadHighlights = vi.fn(async () => []);
    const inner = innerSource({ loadHighlights });
    const store = memStore();
    const src = new CachedSource(inner, { store, cache: false });
    expect(await src.loadHighlights('b')).toEqual([]);
    expect(loadHighlights).toHaveBeenCalledWith('b');

    await store.set('pore:highlights:b', [{ id: 'h1' }]);
    loadHighlights.mockClear();
    expect(await src.loadHighlights('b')).toEqual([{ id: 'h1' }]);
    expect(loadHighlights).not.toHaveBeenCalled();
  });

  it('loadHighlights/saveHighlights degrade gracefully when the inner source has neither', async () => {
    const inner = innerSource();
    const src = new CachedSource(inner, { store: memStore(), cache: false });
    expect(await src.loadHighlights('b')).toEqual([]);
    await expect(src.saveHighlights('b', [])).resolves.toBeUndefined();
  });

  it('passes manifest/page/file straight through', async () => {
    const inner = innerSource();
    const src = new CachedSource(inner, { store: memStore(), cache: false });
    await src.getManifest('b');
    await src.getPage('b', 0);
    expect(inner.getManifest).toHaveBeenCalled();
    expect(inner.getPage).toHaveBeenCalled();
  });
});

function imageInner(pageCount: number, pageBytes = 10): ReaderSource {
  return innerSource({
    getManifest: vi.fn(
      async () =>
        ({
          bookId: 'b',
          type: 'image',
          title: 't',
          direction: 'ltr',
          pageCount,
          pages: Array.from({ length: pageCount }, (_, index) => ({ index })),
        }) as const,
    ),
    getPage: vi.fn(async (_b: string, i: number) => new Blob([new Uint8Array(pageBytes).fill(i)])),
  });
}

describe('CachedSource — offline media cache', () => {
  it('downloads every page, then serves them without touching the source', async () => {
    const inner = imageInner(4);
    const src = new CachedSource(inner, { cache: { store: memStore() } });

    const progress: number[] = [];
    await src.download('b', { onProgress: (s) => progress.push(s.cached) });
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(await src.downloadState('b')).toBe('complete');

    (inner.getPage as ReturnType<typeof vi.fn>).mockClear();
    const p2 = await src.getPage('b', 2);
    expect(p2).toBeInstanceOf(Blob);
    expect(inner.getPage).not.toHaveBeenCalled();
  });

  it('resumes a partial download and reports partial state', async () => {
    const store = memStore();
    const inner = imageInner(5);
    const src = new CachedSource(inner, { cache: { store } });

    const ac = new AbortController();
    let seen = 0;
    await expect(
      src.download('b', {
        onProgress: () => {
          if (++seen === 2) ac.abort();
        },
        signal: ac.signal,
      }),
    ).rejects.toThrow();
    expect(await src.downloadState('b')).toBe('partial');

    await src.download('b'); // resume
    expect(await src.downloadStatus('b')).toMatchObject({ state: 'complete', cached: 5, total: 5 });
    // only the missing pages were fetched on resume
    expect((inner.getPage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5);
  });

  it('downloads a text book as a single file blob', async () => {
    const inner = innerSource({
      getManifest: vi.fn(async () => ({ bookId: 'b', type: 'epub', title: 't' }) as const),
      getFile: vi.fn(async () => new Blob([new Uint8Array(32)])),
    });
    const src = new CachedSource(inner, { cache: { store: memStore() } });
    await src.download('b');
    expect(await src.downloadState('b')).toBe('complete');

    (inner.getFile as ReturnType<typeof vi.fn>).mockClear();
    await src.getFile('b');
    expect(inner.getFile).not.toHaveBeenCalled();
  });

  it('evicts the least-recently-used book when over budget', async () => {
    const store = memStore();
    const src = new CachedSource(imageInner(2, 100), { cache: { store, budgetBytes: 500 } });

    await src.download('a');
    await src.download('b');
    await src.download('c'); // 3 books * 200 bytes = 600 > 500 → evict "a"

    expect(await src.downloadState('a')).toBe('none');
    expect(await src.downloadState('c')).toBe('complete');
  });
});
