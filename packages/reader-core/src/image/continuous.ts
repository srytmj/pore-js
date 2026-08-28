import type { ImagePage } from '../source/types.js';

export interface VerticalLayout {
  /** Rendered height of each page, in px. */
  heights: number[];
  /** Cumulative top offset of each page (includes gaps). */
  offsets: number[];
  /** Total scrollable content height. */
  total: number;
}

/**
 * Estimate a vertical webtoon layout. Pages with known intrinsic dimensions are
 * scaled to `contentWidth`; the rest use `fallbackHeight` until measured.
 */
export function estimateVerticalLayout(
  pages: ImagePage[],
  contentWidth: number,
  fallbackHeight: number,
  gap: number,
  measured?: ReadonlyMap<number, number>,
): VerticalLayout {
  const heights: number[] = [];
  const offsets: number[] = [];
  let y = 0;
  for (let i = 0; i < pages.length; i++) {
    const m = measured?.get(i);
    let h: number;
    if (typeof m === 'number' && m > 0) {
      h = m;
    } else {
      const p = pages[i]!;
      h =
        p.width && p.height && contentWidth > 0
          ? (p.height / p.width) * contentWidth
          : fallbackHeight;
    }
    heights.push(h);
    offsets.push(y);
    y += h + gap;
  }
  return { heights, offsets, total: Math.max(0, y - gap) };
}

/** Indices of pages intersecting the viewport, expanded by `overscanPx`. */
export function visibleRange(
  layout: VerticalLayout,
  scrollTop: number,
  viewportHeight: number,
  overscanPx: number,
): { first: number; last: number } {
  const n = layout.offsets.length;
  if (n === 0) return { first: 0, last: -1 };
  const top = scrollTop - overscanPx;
  const bottom = scrollTop + viewportHeight + overscanPx;
  let first = 0;
  while (first < n - 1 && layout.offsets[first + 1]! <= top) first++;
  let last = first;
  while (last < n - 1 && layout.offsets[last + 1]! < bottom) last++;
  return { first, last };
}

/** The page whose box contains (or is nearest below) `scrollTop`. */
export function pageAtOffset(layout: VerticalLayout, scrollTop: number): number {
  const n = layout.offsets.length;
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? layout.offsets[i + 1]! : layout.total;
    if (scrollTop < next) return i;
  }
  return Math.max(0, n - 1);
}

/** scrollTop that places the top of `pageIndex` at the top of the viewport. */
export function scrollForPage(layout: VerticalLayout, pageIndex: number): number {
  return layout.offsets[Math.min(Math.max(pageIndex, 0), layout.offsets.length - 1)] ?? 0;
}
