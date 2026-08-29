import type { Position } from '../position/types.js';

const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, table, img, section > div';

export type RectOf = (el: Element) => { left: number; right: number; top: number; bottom: number };

const domRect: RectOf = (el) => el.getBoundingClientRect();

/** Ordered list of candidate block elements in a spine document body. */
export function blockElements(doc: Document): Element[] {
  const body = doc.body;
  if (!body) return [];
  return Array.from(body.querySelectorAll(BLOCK_SELECTOR)).filter((el) => {
    if (el.tagName === 'IMG' || el.tagName === 'TABLE') return true;
    return (el.textContent ?? '').trim().length > 0;
  });
}

/**
 * Anchor for the current view: the first block whose box intersects the visible
 * column (x in [0, pageWidth), y >= 0 after the pagination transform).
 */
export function generateAnchor(
  doc: Document,
  opts: {
    spine: number;
    page: number;
    spinePages: number;
    bookPercent: number;
    pageWidth: number;
  },
  rectOf: RectOf = domRect,
): Position {
  const blocks = blockElements(doc);
  let block = 0;
  for (let i = 0; i < blocks.length; i++) {
    const r = rectOf(blocks[i]!);
    if (r.right > 1 && r.left < opts.pageWidth - 1 && r.bottom > 0) {
      block = i;
      break;
    }
  }
  return {
    type: 'anchor',
    spine: opts.spine,
    block,
    offset: 0,
    percent: opts.bookPercent,
  };
}

/**
 * Which 0-based page a block sits on, from its left edge relative to the
 * *untransformed* body. `pageStep` is the x distance between pages.
 * Caller resets the transform before measuring.
 */
export function pageForElement(el: Element, pageStep: number, rectOf: RectOf = domRect): number {
  if (pageStep <= 0) return 0;
  return Math.max(0, Math.round(rectOf(el).left / pageStep));
}

export interface ResolvedAnchor {
  page: number;
  /** true when the exact block was found; false = percentage fallback used */
  exact: boolean;
}

/**
 * Resolve an anchor to a page within the current spine doc. Cascade:
 * exact block → nearest existing block → percentage of the spine.
 */
export function resolveAnchor(
  doc: Document,
  anchor: Extract<Position, { type: 'anchor' }>,
  opts: { spinePages: number; pageStep: number; byPercent?: boolean },
  rectOf: RectOf = domRect,
): ResolvedAnchor {
  const blocks = blockElements(doc);
  const target = blocks[anchor.block] ?? blocks[Math.min(anchor.block, blocks.length - 1)];
  // vertical-rl / flow boxes don't map to pages by `rect.left`; use the percent.
  if (target && !opts.byPercent) {
    return {
      page: Math.min(
        pageForElement(target, opts.pageStep, rectOf),
        Math.max(0, opts.spinePages - 1),
      ),
      exact: !!blocks[anchor.block],
    };
  }
  // percentage fallback
  const spineFraction = anchor.percent; // best available signal
  return {
    page: Math.min(
      Math.round(spineFraction * Math.max(0, opts.spinePages - 1)),
      Math.max(0, opts.spinePages - 1),
    ),
    exact: false,
  };
}
