import { describe, expect, it, vi } from 'vitest';
import { DemoSource } from './demo-source.js';

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const body = routes[url];
    if (body === undefined) {
      return new Response(null, { status: 404 });
    }
    if (body instanceof Blob) return new Response(body, { status: 200 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

const MANIFEST_URL = '/fixtures/demo-manga/manifest.json';

describe('DemoSource', () => {
  it('loads and caches a manifest', async () => {
    const fetch = fakeFetch({
      [MANIFEST_URL]: {
        title: 'Demo',
        direction: 'rtl',
        pages: [{ src: '1.svg' }, { src: '2.svg' }],
      },
    });
    const src = new DemoSource({ fetch });
    const m = await src.getManifest('demo-manga');
    expect(m.type).toBe('image');
    if (m.type === 'image') expect(m.pageCount).toBe(2);
    await src.getManifest('demo-manga');
    expect(fetch).toHaveBeenCalledTimes(1); // cached
  });

  it('fetches a page as a Blob', async () => {
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/svg+xml' });
    const src = new DemoSource({
      fetch: fakeFetch({
        [MANIFEST_URL]: { pages: [{ src: 'p1.svg' }] },
        '/fixtures/demo-manga/p1.svg': png,
      }),
    });
    const blob = await src.getPage('demo-manga', 0);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(3);
  });

  it('rejects an out-of-range page', async () => {
    const src = new DemoSource({
      fetch: fakeFetch({ [MANIFEST_URL]: { pages: [{ src: 'p1.svg' }] } }),
    });
    await expect(src.getPage('demo-manga', 5)).rejects.toThrow(/out of range/);
  });

  it('propagates an abort signal', async () => {
    const src = new DemoSource({
      fetch: fakeFetch({
        [MANIFEST_URL]: { pages: [{ src: 'p1.svg' }] },
        '/fixtures/demo-manga/p1.svg': new Blob(['x']),
      }),
    });
    const ac = new AbortController();
    ac.abort();
    await expect(src.getPage('demo-manga', 0, { signal: ac.signal })).rejects.toThrow(/Abort/);
  });

  it('round-trips progress in memory', async () => {
    const src = new DemoSource({ fetch: fakeFetch({}) });
    expect(await src.loadProgress('x')).toBeNull();
    await src.saveProgress('x', { type: 'page', value: 4, total: 10 });
    expect(await src.loadProgress('x')).toEqual({ type: 'page', value: 4, total: 10 });
  });

  it('throws a clear error on a missing manifest', async () => {
    const src = new DemoSource({ fetch: fakeFetch({}) });
    await expect(src.getManifest('nope')).rejects.toThrow(/HTTP 404/);
  });
});
