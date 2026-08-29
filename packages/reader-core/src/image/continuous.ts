import type { ImagePage } from '../source/types.js';

export type ContinuousAxis = 'y' | 'x';

export interface LinearLayout {
  /** Main-axis size of each page, in px (height for 'y', width for 'x'). */
  sizes: number[];
  /** Cumulative main-axis offset of each page (includes gaps). */
  offsets: number[];
  /** Total scrollable content extent on the main axis. */
  total: number;
}

/** @deprecated use {@link LinearLayout} */
export type VerticalLayout = LinearLayout;

export interface LinearLayoutOptions {
  axis: ContinuousAxis;
  /** Cross-axis content size (container width for 'y', height for 'x'). */
  crossSize: number;
  /** Main-axis size to use for pages of unknown dimension, until measured. */
  fallbackMain: number;
  gap: number;
  measured?: ReadonlyMap<number, number>;
}

/**
 * Estimate a virtualised continuous layout on one axis. Pages with known
 * intrinsic dimensions are scaled to `crossSize`; the rest use `fallbackMain`.
 */
export function estimateLinearLayout(pages: ImagePage[], opts: LinearLayoutOptions): LinearLayout {
  const { axis, crossSize, fallbackMain, gap, measured } = opts;
  const sizes: number[] = [];
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pages.length; i++) {
    const m = measured?.get(i);
    let size: number;
    if (typeof m === 'number' && m > 0) {
      size = m;
    } else {
      const p = pages[i]!;
      if (p.width && p.height && crossSize > 0) {
        size = axis === 'y' ? (p.height / p.width) * crossSize : (p.width / p.height) * crossSize;
      } else {
        size = fallbackMain;
      }
    }
    sizes.push(size);
    offsets.push(acc);
    acc += size + gap;
  }
  return { sizes, offsets, total: Math.max(0, acc - gap) };
}

/** Vertical convenience wrapper (kept for existing call sites/tests). */
export function estimateVerticalLayout(
  pages: ImagePage[],
  contentWidth: number,
  fallbackHeight: number,
  gap: number,
  measured?: ReadonlyMap<number, number>,
): LinearLayout {
  return estimateLinearLayout(pages, {
    axis: 'y',
    crossSize: contentWidth,
    fallbackMain: fallbackHeight,
    gap,
    ...(measured ? { measured } : {}),
  });
}

/** Indices of pages intersecting the viewport, expanded by `overscanPx`. */
export function visibleRange(
  layout: LinearLayout,
  scroll: number,
  viewportMain: number,
  overscanPx: number,
): { first: number; last: number } {
  const n = layout.offsets.length;
  if (n === 0) return { first: 0, last: -1 };
  const lo = scroll - overscanPx;
  const hi = scroll + viewportMain + overscanPx;
  let first = 0;
  while (first < n - 1 && layout.offsets[first + 1]! <= lo) first++;
  let last = first;
  while (last < n - 1 && layout.offsets[last + 1]! < hi) last++;
  return { first, last };
}

/** The page whose box contains (or is nearest past) `scroll`. */
export function pageAtOffset(layout: LinearLayout, scroll: number): number {
  const n = layout.offsets.length;
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? layout.offsets[i + 1]! : layout.total;
    if (scroll < next) return i;
  }
  return Math.max(0, n - 1);
}

/** Scroll offset that places the leading edge of `pageIndex` at the viewport edge. */
export function scrollForPage(layout: LinearLayout, pageIndex: number): number {
  return layout.offsets[Math.min(Math.max(pageIndex, 0), layout.offsets.length - 1)] ?? 0;
}
