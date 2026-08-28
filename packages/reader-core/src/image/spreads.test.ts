import { describe, expect, it } from 'vitest';
import { buildSpreads, isNaturallyWide, spreadIndexForPage } from './spreads.js';
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

describe('isNaturallyWide', () => {
  it('trusts an explicit isWide', () => {
    expect(isNaturallyWide({ index: 0, isWide: false }, 3000, 100)).toBe(false);
    expect(isNaturallyWide({ index: 0, isWide: true }, 100, 3000)).toBe(true);
  });

  it('defers to manifest dimensions when present', () => {
    expect(isNaturallyWide({ index: 0, width: 800, height: 1200 }, 3000, 100)).toBe(false);
  });

  it('uses natural aspect when the manifest is silent', () => {
    expect(isNaturallyWide({ index: 0 }, 1600, 1200)).toBe(true);
    expect(isNaturallyWide({ index: 0 }, 800, 1200)).toBe(false);
  });

  it('is safe before decode (0×0)', () => {
    expect(isNaturallyWide({ index: 0 }, 0, 0)).toBe(false);
  });
});

describe('re-pairing after a late wide discovery', () => {
  it('splits the pair once page 2 is known to be wide', () => {
    const before = buildSpreads(pages(5), {
      layout: 'paged-double',
      direction: 'ltr',
      spreadOffset: 0,
    });
    expect(before.map((s) => s.pages)).toEqual([[0, 1], [2, 3], [4]]);
    const after = buildSpreads(pages(5, [2]), {
      layout: 'paged-double',
      direction: 'ltr',
      spreadOffset: 0,
    });
    expect(after.map((s) => s.pages)).toEqual([[0, 1], [2], [3, 4]]);
  });
});

describe('spreadIndexForPage', () => {
  it('finds the spread holding a page', () => {
    const s = buildSpreads(pages(4), { layout: 'paged-double', direction: 'rtl', spreadOffset: 0 });
    expect(spreadIndexForPage(s, 3)).toBe(1);
    expect(spreadIndexForPage(s, 0)).toBe(0);
  });
});
