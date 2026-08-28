import { describe, expect, it, vi } from 'vitest';
import { PrefetchScheduler, type PreloadSettings } from './prefetch.js';
import type { PageLoader } from './page-loader.js';
import type { ImagePage } from '../source/types.js';

const SETTINGS: PreloadSettings = {
  preload: true,
  preloadStrategy: 'window',
  preloadAhead: 3,
  preloadBehind: 1,
  preloadAllMaxMB: 512,
};

function fakeLoader(bytesPerPage = 1024) {
  const loaded = new Set<number>();
  const gets: number[] = [];
  const loader = {
    isLoaded: (i: number) => loaded.has(i),
    bytesOf: () => bytesPerPage,
    get: vi.fn(async (i: number) => {
      gets.push(i);
      loaded.add(i);
      return `blob:${i}`;
    }),
  } as unknown as PageLoader;
  return { loader, gets, loaded };
}

const pages = (n: number, dims?: [number, number]): ImagePage[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    ...(dims ? { width: dims[0], height: dims[1] } : {}),
  }));

describe('PrefetchScheduler — window', () => {
  it('fetches the ring buffer around the current page', async () => {
    const { loader, gets } = fakeLoader();
    const s = new PrefetchScheduler({ loader, pages: pages(20), settings: SETTINGS });
    s.update(10);
    await Promise.resolve();
    expect([...gets].sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13]);
  });

  it('clamps at the start', async () => {
    const { loader, gets } = fakeLoader();
    const s = new PrefetchScheduler({ loader, pages: pages(20), settings: SETTINGS });
    s.update(0);
    await Promise.resolve();
    expect([...gets].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});

describe('PrefetchScheduler — all', () => {
  const allSettings: PreloadSettings = { ...SETTINGS, preloadStrategy: 'all' };

  it('enqueues the whole chapter, active → end → start', async () => {
    const { loader, gets } = fakeLoader();
    const s = new PrefetchScheduler({
      loader,
      pages: pages(8),
      settings: allSettings,
      concurrency: 1,
    });
    s.update(3);
    await new Promise((r) => setTimeout(r, 5));
    expect(gets).toEqual([3, 4, 5, 6, 7, 2, 1, 0]);
  });

  it('refuses up front when the estimate exceeds the cap', async () => {
    const { loader, gets } = fakeLoader();
    const onCapped = vi.fn();
    // 30 pages × 4000×3000 × 0.5 B ≈ 180 MB per page → way over a 1 MB cap
    const s = new PrefetchScheduler({
      loader,
      pages: pages(30, [4000, 3000]),
      settings: { ...allSettings, preloadAllMaxMB: 1 },
      onCapped,
      concurrency: 2,
    });
    s.update(0);
    await new Promise((r) => setTimeout(r, 5));
    expect(onCapped).toHaveBeenCalledWith('estimate');
    // falls back to a window
    expect(gets.length).toBeLessThanOrEqual(5);
  });

  it('halts mid-run when the running byte total crosses the cap', async () => {
    const { loader, gets } = fakeLoader(2 * 1024 * 1024); // 2 MB per page
    const onCapped = vi.fn();
    const s = new PrefetchScheduler({
      loader,
      pages: pages(50), // no dims → assumed ~0.6 MB/page ≈ 30 MB, passes the 40 MB up-front check
      settings: { ...allSettings, preloadAllMaxMB: 40 },
      onCapped,
      concurrency: 1,
    });
    s.update(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(onCapped).toHaveBeenCalledWith('runtime');
    expect(gets.length).toBeLessThan(50);
  });
});
