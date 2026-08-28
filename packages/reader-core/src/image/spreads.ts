import type { Direction, LayoutMode } from '../types.js';
import type { ImagePage } from '../source/types.js';

/**
 * A unit of display: one page (single / continuous) or up to two paired pages
 * (double spread). `pages` is in visual left→right order; `leading` is the
 * logically-first page in reading order (what `Position.value` stores).
 */
export interface Spread {
  index: number;
  pages: number[];
  leading: number;
}

export interface SpreadOptions {
  layout: LayoutMode;
  direction: Direction;
  spreadOffset: 0 | 1;
}

function isWide(p: ImagePage | undefined): boolean {
  return p?.isWide === true;
}

/** Build the spread list for a manifest under the given layout options. Pure. */
export function buildSpreads(pages: ImagePage[], opts: SpreadOptions): Spread[] {
  const n = pages.length;
  if (n === 0) return [];

  if (opts.layout !== 'paged-double') {
    return pages.map((p, i) => ({ index: i, pages: [p.index], leading: p.index }));
  }

  const out: Spread[] = [];
  let i = 0;

  const push = (ids: number[], leading: number) => {
    const visual = opts.direction === 'rtl' && ids.length === 2 ? [ids[1]!, ids[0]!] : ids;
    out.push({ index: out.length, pages: visual, leading });
  };

  if (opts.spreadOffset === 1) {
    push([pages[0]!.index], pages[0]!.index);
    i = 1;
  }

  while (i < n) {
    const cur = pages[i]!;
    const next = pages[i + 1];
    if (isWide(cur) || !next || isWide(next)) {
      push([cur.index], cur.index);
      i += 1;
    } else {
      push([cur.index, next.index], cur.index);
      i += 2;
    }
  }
  return out;
}

/** Index of the spread that contains `pageIndex` (0 if not found). */
export function spreadIndexForPage(spreads: Spread[], pageIndex: number): number {
  const found = spreads.findIndex((s) => s.pages.includes(pageIndex));
  return found === -1 ? 0 : found;
}

/** Clamp a spread index into range. */
export function clampSpreadIndex(spreads: Spread[], index: number): number {
  if (spreads.length === 0) return 0;
  return Math.min(spreads.length - 1, Math.max(0, index));
}
