import type { Position } from '../position/types.js';

const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure, table, img, section > div';

export type Rect = { left: number; right: number; top: number; bottom: number };
export type RectOf = (el: Element) => Rect;
export type RangeRectOf = (range: Range) => Rect;

const domRect: RectOf = (el) => el.getBoundingClientRect();
const ZERO_RECT: Rect = { left: 0, right: 0, top: 0, bottom: 0 };
// jsdom's Range doesn't implement getBoundingClientRect at all (throws) — treat
// that the same as "no layout signal" rather than letting it crash callers.
const domRangeRect: RangeRectOf = (r) => {
  try {
    return r.getBoundingClientRect();
  } catch {
    return ZERO_RECT;
  }
};

/**
 * Character offset (into `el`'s flattened `textContent`) of the first word
 * whose own rect satisfies `visible` — i.e. which word within a
 * possibly-multi-page block actually starts the visible page. Word-granularity
 * (not per-character) keeps this cheap: one `Range` + layout read per word,
 * not per character.
 */
export function offsetForVisibleWord(
  el: Element,
  doc: Document,
  visible: (r: Rect) => boolean,
  rangeRectOf: RangeRectOf = domRangeRect,
): number {
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let base = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const range = doc.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      if (visible(rangeRectOf(range))) return base + m.index;
      re.lastIndex = m.index + m[0].length;
    }
    base += text.length;
  }
  return 0;
}

/** A `Range` covering one character at `offset` into `el`'s flattened text, or `null` past the end. */
export function rangeAtOffset(el: Element, doc: Document, offset: number): Range | null {
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let base = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (offset < base + len) {
      const range = doc.createRange();
      const local = offset - base;
      range.setStart(node, local);
      range.setEnd(node, Math.min(local + 1, len));
      return range;
    }
    base += len;
  }
  return null;
}

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
  rangeRectOf: RangeRectOf = domRangeRect,
): Position {
  const blocks = blockElements(doc);
  const visible = (r: Rect) => r.right > 1 && r.left < opts.pageWidth - 1 && r.bottom > 0;
  let block = 0;
  let offset = 0;
  for (let i = 0; i < blocks.length; i++) {
    const r = rectOf(blocks[i]!);
    if (visible(r)) {
      block = i;
      // The block itself may span several pages (one long paragraph); find
      // which word within it actually starts *this* page, not just the block.
      offset = offsetForVisibleWord(blocks[i]!, doc, visible, rangeRectOf);
      break;
    }
  }
  return {
    type: 'anchor',
    spine: opts.spine,
    block,
    offset,
    percent: opts.bookPercent,
  };
}

/**
 * Which 0-based page a block sits on, from its left edge relative to the
 * *untransformed* body. `pageStep` is the x distance between pages.
 * Caller resets the transform before measuring.
 */
export function pageForElement(el: Element, pageStep: number, rectOf: RectOf = domRect): number {
  return pageForRect(rectOf(el), pageStep);
}

/** Shared by `pageForElement` and the offset-refined path in `resolveAnchor`. */
function pageForRect(r: Rect, pageStep: number): number {
  if (pageStep <= 0) return 0;
  return Math.max(0, Math.round(r.left / pageStep));
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
  rangeRectOf: RangeRectOf = domRangeRect,
): ResolvedAnchor {
  const blocks = blockElements(doc);
  const target = blocks[anchor.block] ?? blocks[Math.min(anchor.block, blocks.length - 1)];
  // vertical-rl / flow boxes don't map to pages by `rect.left`; use the percent.
  if (target && !opts.byPercent) {
    const maxPage = Math.max(0, opts.spinePages - 1);
    // A block can span several pages; when the anchor recorded which word
    // started the page, prefer that word's own position over the whole
    // block's (which would always land on the block's *first* page).
    if (anchor.offset > 0) {
      const range = rangeAtOffset(target, doc, anchor.offset);
      if (range) {
        const r = rangeRectOf(range);
        if (r.right > 0 || r.left > 0) {
          return {
            page: Math.min(pageForRect(r, opts.pageStep), maxPage),
            exact: !!blocks[anchor.block],
          };
        }
      }
    }
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
