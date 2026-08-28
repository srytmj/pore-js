import { describe, expect, it } from 'vitest';
import { buildSpreads, spreadIndexForPage } from './spreads.js';
import type { ImagePage } from '../source/types.js';

const pages = (n: number, wide: number[] = []): ImagePage[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    ...(wide.includes(i) ? { isWide: true } : {}),
  }));

describe('buildSpreads', () => {
  it('single mode → one page per spread', () => {
    const s = buildSpreads(pages(3), { layout: 'paged-single', direction: 'ltr', spreadOffset: 0 });
    expect(s.map((x) => x.pages)).toEqual([[0], [1], [2]]);
  });

  it('double mode pairs pages LTR', () => {
    const s = buildSpreads(pages(4), { layout: 'paged-double', direction: 'ltr', spreadOffset: 0 });
    expect(s.map((x) => x.pages)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(s.map((x) => x.leading)).toEqual([0, 2]);
  });

  it('double mode reverses visual order RTL, keeps leading', () => {
    const s = buildSpreads(pages(4), { layout: 'paged-double', direction: 'rtl', spreadOffset: 0 });
    expect(s.map((x) => x.pages)).toEqual([
      [1, 0],
      [3, 2],
    ]);
    expect(s.map((x) => x.leading)).toEqual([0, 2]);
  });

  it('spreadOffset 1 makes page 0 solo then pairs', () => {
    const s = buildSpreads(pages(5), { layout: 'paged-double', direction: 'ltr', spreadOffset: 1 });
    expect(s.map((x) => x.pages)).toEqual([[0], [1, 2], [3, 4]]);
  });

  it('a wide page takes its own spread and pairing resumes after', () => {
    const s = buildSpreads(pages(5, [2]), {
      layout: 'paged-double',
      direction: 'ltr',
      spreadOffset: 0,
    });
    expect(s.map((x) => x.pages)).toEqual([[0, 1], [2], [3, 4]]);
  });

  it('handles an odd tail page solo', () => {
    const s = buildSpreads(pages(3), { layout: 'paged-double', direction: 'ltr', spreadOffset: 0 });
    expect(s.map((x) => x.pages)).toEqual([[0, 1], [2]]);
  });

  it('empty manifest → no spreads', () => {
    expect(buildSpreads([], { layout: 'paged-double', direction: 'ltr', spreadOffset: 0 })).toEqual(
      [],
    );
  });
});

describe('spreadIndexForPage', () => {
  it('finds the spread holding a page', () => {
    const s = buildSpreads(pages(4), { layout: 'paged-double', direction: 'rtl', spreadOffset: 0 });
    expect(spreadIndexForPage(s, 3)).toBe(1);
    expect(spreadIndexForPage(s, 0)).toBe(0);
  });
});
