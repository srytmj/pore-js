// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageEngine } from './create-image-engine.js';
import { DemoSource } from '../source/demo-source.js';

let seq = 0;
beforeEach(() => {
  seq = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:mock/${++seq}`,
    revokeObjectURL: () => {},
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function source(pages: number, chapters?: { id: string; label: string; startIndex: number }[]) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('manifest.json')) {
      return new Response(
        JSON.stringify({
          direction: 'ltr',
          ...(chapters ? { chapters } : {}),
          pages: Array.from({ length: pages }, (_, i) => ({ src: `p${i}.svg` })),
        }),
        { status: 200 },
      );
    }
    return new Response(new Blob(['<svg/>']), { status: 200 });
  }) as unknown as typeof fetch;
  return new DemoSource({ fetch });
}

describe('paged auto-advance', () => {
  it('flips forward on the configured interval', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(5),
      bookId: 'b',
      settings: { pagedAutoAdvanceSeconds: 3 },
    });
    const seen: number[] = [];
    engine.on('reader:locationchange', (p) => seen.push(p.page));
    await engine.mount();

    vi.advanceTimersByTime(3000);
    expect(seen.at(-1)).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(seen.at(-1)).toBe(2);
    engine.destroy();
  });
});

describe('autoscroll (stepped)', () => {
  it('emits running true/false around the setting and steps a screen per tick', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(6),
      bookId: 'b',
      settings: { layout: 'continuous-vertical', autoscrollSmooth: false, autoscrollSpeed: 400 },
    });
    const running: boolean[] = [];
    const loc: number[] = [];
    engine.on('reader:autoscroll', (p) => running.push(p.running));
    engine.on('reader:locationchange', (p) => loc.push(p.page));
    await engine.mount();
    const el = container.querySelector('.pore-image') as HTMLElement;
    Object.defineProperty(el, 'clientHeight', { value: 800, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true });

    engine.setSettings({ autoscroll: true });
    expect(running.at(-1)).toBe(true);
    vi.advanceTimersByTime(4200); // 800px / 400px·s = 2s per step → ~2 steps
    expect(el.scrollTop).toBeGreaterThan(0);
    void loc;

    engine.setSettings({ autoscroll: false });
    expect(running.at(-1)).toBe(false);
    engine.destroy();
  });
});

describe('next-chapter auto-advance', () => {
  it('emits reader:autoadvance at book end and jumps after the delay', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(6, [
        { id: 'c1', label: 'One', startIndex: 0 },
        { id: 'c2', label: 'Two', startIndex: 3 },
      ]),
      bookId: 'b',
      settings: { nextChapterAfterLastPage: 3 },
    });
    const adv: Array<{ toChapter: string | null; inMs: number }> = [];
    const loc: number[] = [];
    engine.on('reader:autoadvance', (p) => adv.push(p));
    engine.on('reader:locationchange', (p) => loc.push(p.page));
    await engine.mount();

    engine.goto(2); // last page of chapter 1
    engine.turn('forward'); // hits chapter boundary → end + arm
    expect(adv.at(-1)).toEqual({ toChapter: 'c2', inMs: 3000 });

    vi.advanceTimersByTime(3000);
    expect(loc.at(-1)).toBe(3); // chapter 2 start
    engine.destroy();
  });

  it('cancels the pending advance on a manual page turn', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const engine = createImageEngine({
      container,
      source: source(6, [
        { id: 'c1', label: 'One', startIndex: 0 },
        { id: 'c2', label: 'Two', startIndex: 3 },
      ]),
      bookId: 'b',
      settings: { nextChapterAfterLastPage: 5 },
    });
    const adv: number[] = [];
    engine.on('reader:autoadvance', (p) => adv.push(p.inMs));
    await engine.mount();
    engine.goto(2);
    engine.turn('forward');
    container
      .querySelector('.pore-image')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(adv.at(-1)).toBe(-1); // cancelled
    engine.destroy();
  });
});
