// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageEngine, physicalToLogical } from './create-image-engine.js';
import { DemoSource } from '../source/demo-source.js';
import type { ImageEngineEvents } from './types.js';

let urlSeq = 0;
beforeEach(() => {
  urlSeq = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:mock/${++urlSeq}`,
    revokeObjectURL: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());

function source(pages: number, opts: { direction?: 'ltr' | 'rtl' } = {}) {
  const manifestUrl = '/fixtures/b/manifest.json';
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === manifestUrl) {
      return new Response(
        JSON.stringify({
          direction: opts.direction ?? 'ltr',
          pages: Array.from({ length: pages }, (_, i) => ({ src: `p${i}.svg` })),
        }),
        { status: 200 },
      );
    }
    return new Response(new Blob(['<svg/>'], { type: 'image/svg+xml' }), { status: 200 });
  }) as unknown as typeof fetch;
  return new DemoSource({ fetch });
}

function collect<E extends keyof ImageEngineEvents>(
  engine: ReturnType<typeof createImageEngine>,
  event: E,
) {
  const seen: ImageEngineEvents[E][] = [];
  engine.on(event, (p) => seen.push(p));
  return seen;
}

describe('physicalToLogical', () => {
  it('LTR: right = forward', () => {
    expect(physicalToLogical('page-right', 'ltr')).toBe('forward');
    expect(physicalToLogical('page-left', 'ltr')).toBe('back');
  });
  it('RTL: right = back', () => {
    expect(physicalToLogical('page-right', 'rtl')).toBe('back');
    expect(physicalToLogical('page-left', 'rtl')).toBe('forward');
  });
});

describe('createImageEngine (paged-single)', () => {
  it('mounts, emits ready + first location, paints a page', async () => {
    const container = document.createElement('div');
    const engine = createImageEngine({ container, source: source(5), bookId: 'b' });
    const ready = collect(engine, 'reader:ready');
    const loc = collect(engine, 'reader:locationchange');

    await engine.mount();

    expect(ready).toHaveLength(1);
    expect(loc.at(-1)?.page).toBe(0);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    engine.destroy();
  });

  it('turn(forward/back) moves by one page and clamps at the ends', async () => {
    const container = document.createElement('div');
    const engine = createImageEngine({ container, source: source(3), bookId: 'b' });
    const loc = collect(engine, 'reader:locationchange');
    const end = collect(engine, 'reader:end');
    const start = collect(engine, 'reader:start');
    await engine.mount();

    engine.turn('forward');
    expect(loc.at(-1)?.page).toBe(1);
    engine.turn('forward');
    expect(loc.at(-1)?.page).toBe(2);
    engine.turn('forward');
    expect(end).toHaveLength(1);
    expect(loc.at(-1)?.page).toBe(2); // unchanged

    engine.goto(0);
    engine.turn('back');
    expect(start).toHaveLength(1);
    engine.destroy();
  });

  it('goto jumps to a page', async () => {
    const container = document.createElement('div');
    const engine = createImageEngine({ container, source: source(10), bookId: 'b' });
    const loc = collect(engine, 'reader:locationchange');
    await engine.mount();
    engine.goto(7);
    expect(loc.at(-1)?.page).toBe(7);
    engine.destroy();
  });

  it('double layout pairs pages and reports the leading page', async () => {
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(4),
      bookId: 'b',
      settings: { layout: 'paged-double' },
    });
    const loc = collect(engine, 'reader:locationchange');
    await engine.mount();
    expect(container.querySelectorAll('img')).toHaveLength(2);
    engine.turn('forward');
    expect(loc.at(-1)?.page).toBe(2);
    engine.destroy();
  });

  it('toggle-spread-offset (key "o") re-pairs and keeps the current page on screen', async () => {
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(6),
      bookId: 'b',
      settings: { layout: 'paged-double', direction: 'ltr' },
    });
    const layout = collect(engine, 'reader:layoutchange');
    await engine.mount();
    engine.turn('forward'); // spread [2,3]
    const altCount = container.querySelectorAll('img').length;
    expect(altCount).toBe(2);

    container
      .querySelector('.pore-image')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true }));

    // offset 1 → spreads [0] [1,2] [3,4] [5]; page 2 still rendered
    const alts = [...container.querySelectorAll('img')].map((i) => i.getAttribute('alt'));
    expect(alts).toContain('page 3'); // 0-based index 2
    expect(layout.length).toBeGreaterThan(1);
    engine.destroy();
  });

  it('restores the last-read checkpoint before first paint', async () => {
    const src = source(20);
    await src.saveProgress('b', { type: 'page', value: 8, total: 20 });
    const container = document.createElement('div');
    const engine = createImageEngine({ container, source: src, bookId: 'b' });
    const resumed = collect(engine, 'reader:resumed');
    const loc = collect(engine, 'reader:locationchange');
    await engine.mount();
    expect(resumed.at(-1)?.page).toBe(8);
    expect(loc.at(-1)?.page).toBe(8);
    engine.destroy();
  });

  it('rejects a non-image book', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ pages: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    // getFile path not used; force type mismatch via a stub source
    const stub = {
      getManifest: async () => ({ bookId: 'b', type: 'epub' as const, title: 't' }),
      getPage: async () => new Blob(),
      getFile: async () => new Blob(),
      loadProgress: async () => null,
      saveProgress: async () => {},
    };
    const container = document.createElement('div');
    const engine = createImageEngine({ container, source: stub, bookId: 'b' });
    await expect(engine.mount()).rejects.toThrow(/not an image book/);
    void fetch;
  });
});
