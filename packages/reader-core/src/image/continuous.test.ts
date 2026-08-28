import { describe, expect, it } from 'vitest';
import { estimateVerticalLayout, pageAtOffset, scrollForPage, visibleRange } from './continuous.js';
import type { ImagePage } from '../source/types.js';

const dimPages = (n: number, w = 800, h = 1200): ImagePage[] =>
  Array.from({ length: n }, (_, i) => ({ index: i, width: w, height: h }));

describe('estimateVerticalLayout', () => {
  it('scales known dimensions to content width and stacks with gaps', () => {
    const layout = estimateVerticalLayout(dimPages(3, 800, 1200), 400, 999, 10);
    expect(layout.heights).toEqual([600, 600, 600]); // 1200/800 * 400
    expect(layout.offsets).toEqual([0, 610, 1220]);
    expect(layout.total).toBe(1820); // 3*600 + 2*10
  });

  it('uses the fallback height for pages without dimensions', () => {
    const layout = estimateVerticalLayout([{ index: 0 }, { index: 1 }], 400, 500, 0);
    expect(layout.heights).toEqual([500, 500]);
  });

  it('prefers measured heights when supplied', () => {
    const layout = estimateVerticalLayout(dimPages(3), 800, 999, 0, new Map([[1, 742]]));
    expect(layout.heights[1]).toBe(742);
    expect(layout.offsets[2]).toBe(1200 + 742);
  });
});

describe('visibleRange', () => {
  const layout = estimateVerticalLayout(dimPages(10, 800, 1000), 800, 1000, 0); // 1000px each

  it('returns the pages under the viewport plus overscan', () => {
    const r = visibleRange(layout, 2500, 1000, 0);
    expect(r).toEqual({ first: 2, last: 3 });
  });

  it('expands by overscan', () => {
    const r = visibleRange(layout, 2500, 1000, 1000);
    expect(r.first).toBe(1);
    expect(r.last).toBe(4);
  });

  it('clamps at the end', () => {
    const r = visibleRange(layout, 100000, 1000, 0);
    expect(r.last).toBe(9);
  });
});

describe('pageAtOffset / scrollForPage', () => {
  const layout = estimateVerticalLayout(dimPages(5, 800, 1000), 800, 1000, 0);
  it('round-trips a page through its offset', () => {
    for (let i = 0; i < 5; i++) {
      expect(pageAtOffset(layout, scrollForPage(layout, i))).toBe(i);
    }
  });
  it('maps a mid-page offset to that page', () => {
    expect(pageAtOffset(layout, 2500)).toBe(2);
  });
});
