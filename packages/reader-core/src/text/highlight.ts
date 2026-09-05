/**
 * DOM <-> `HighlightRange` conversions: turning a live text selection into the
 * same block-ordinal + flattened-text-offset addressing `anchor.ts` uses for
 * resume positions, and back into a `Range` for rendering. Kept standalone
 * from `anchor.ts` (single-offset resume points) since a highlight needs two
 * endpoints, possibly in different blocks.
 */
import type { HighlightRange } from '../source/types.js';

/** Text-node + local offset for `offset` chars into `el`'s flattened text — the endpoint counterpart of `anchor.ts`'s `rangeAtOffset`. */
export function locateOffset(
  el: Element,
  doc: Document,
  offset: number,
): { node: Text; offset: number } | null {
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let base = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (offset <= base + len) return { node: node as Text, offset: offset - base };
    base += len;
  }
  return null;
}

/** Character offset (into `el`'s flattened `textContent`) of `node`+`nodeOffset`, or `null` when `node` isn't inside `el`. */
export function offsetOfPoint(el: Element, doc: Document, node: Node, nodeOffset: number): number | null {
  if (!el.contains(node)) return null;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let base = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n === node) return base + nodeOffset;
    base += n.textContent?.length ?? 0;
  }
  return null;
}

/** Build a `Range` spanning a highlight's endpoints, resolved against `blocks` (from `blockElements`). */
export function rangeForHighlight(doc: Document, blocks: Element[], h: HighlightRange): Range | null {
  const startEl = blocks[h.startBlock];
  const endEl = blocks[h.endBlock];
  if (!startEl || !endEl) return null;
  const start = locateOffset(startEl, doc, h.startOffset);
  const end = locateOffset(endEl, doc, h.endOffset);
  if (!start || !end) return null;
  const range = doc.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/** Convert a live user-selection `Range` into block-ordinal + offset endpoints (`spine` is left `0`; callers stamp the real spine index). */
export function highlightRangeFromSelection(
  doc: Document,
  blocks: Element[],
  range: Range,
): HighlightRange | null {
  const startBlock = blocks.findIndex((b) => b.contains(range.startContainer));
  const endBlock = blocks.findIndex((b) => b.contains(range.endContainer));
  if (startBlock === -1 || endBlock === -1) return null;
  const startOffset = offsetOfPoint(blocks[startBlock]!, doc, range.startContainer, range.startOffset);
  const endOffset = offsetOfPoint(blocks[endBlock]!, doc, range.endContainer, range.endOffset);
  if (startOffset === null || endOffset === null) return null;
  return { spine: 0, startBlock, startOffset, endBlock, endOffset };
}
