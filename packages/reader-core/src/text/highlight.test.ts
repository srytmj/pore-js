// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blockElements } from './anchor.js';
import {
  highlightRangeFromSelection,
  locateOffset,
  offsetOfPoint,
  rangeForHighlight,
} from './highlight.js';

function docWith(bodyHtml: string): Document {
  return new DOMParser().parseFromString(`<html><body>${bodyHtml}</body></html>`, 'text/html');
}

describe('locateOffset / offsetOfPoint', () => {
  it('are inverses across nested inline markup', () => {
    const doc = docWith('<p>alpha <em>beta</em> gamma</p>');
    const p = doc.querySelector('p')!;
    const full = p.textContent!; // "alpha beta gamma"
    const target = full.indexOf('gamma');
    const point = locateOffset(p, doc, target)!;
    expect(point).not.toBeNull();
    expect(offsetOfPoint(p, doc, point.node, point.offset)).toBe(target);
  });

  it('offsetOfPoint resolves an element-relative boundary point, not just a text-node one', () => {
    // Range.selectNodeContents(el) — and some browsers' whole-block drag
    // selections — produce element/childIndex boundaries, not text-node ones.
    const doc = docWith('<h1>The Beginning</h1>');
    const h1 = doc.querySelector('h1')!;
    const range = doc.createRange();
    range.selectNodeContents(h1);
    expect(range.startContainer).toBe(h1);
    expect(range.endContainer).toBe(h1);
    expect(offsetOfPoint(h1, doc, range.startContainer, range.startOffset)).toBe(0);
    expect(offsetOfPoint(h1, doc, range.endContainer, range.endOffset)).toBe(
      'The Beginning'.length,
    );
  });

  it('offsetOfPoint returns null for a node outside the element', () => {
    const doc = docWith('<p>one</p><p>two</p>');
    const [p1, p2] = doc.querySelectorAll('p');
    const outside = p2!.firstChild!;
    expect(offsetOfPoint(p1!, doc, outside, 0)).toBeNull();
  });

  it('locateOffset returns null past the end of the text', () => {
    const doc = docWith('<p>hi</p>');
    expect(locateOffset(doc.querySelector('p')!, doc, 99)).toBeNull();
  });
});

describe('highlightRangeFromSelection / rangeForHighlight', () => {
  it('round-trips a same-block selection', () => {
    const doc = docWith('<p>alpha beta gamma delta</p>');
    const p = doc.querySelector('p')!;
    const blocks = blockElements(doc);
    const full = p.textContent!;
    const start = full.indexOf('beta');
    const end = start + 'beta gamma'.length;

    const sel = doc.createRange();
    const startPoint = locateOffset(p, doc, start)!;
    const endPoint = locateOffset(p, doc, end)!;
    sel.setStart(startPoint.node, startPoint.offset);
    sel.setEnd(endPoint.node, endPoint.offset);

    const anchorRange = highlightRangeFromSelection(doc, blocks, sel);
    expect(anchorRange).toEqual({
      spine: 0,
      startBlock: 0,
      startOffset: start,
      endBlock: 0,
      endOffset: end,
    });

    const resolved = rangeForHighlight(doc, blocks, anchorRange!);
    expect(resolved!.toString()).toBe('beta gamma');
  });

  it('round-trips a whole-block selection made via selectNodeContents (element-relative boundaries)', () => {
    const doc = docWith('<h1>The Beginning</h1>');
    const h1 = doc.querySelector('h1')!;
    const blocks = blockElements(doc);
    const sel = doc.createRange();
    sel.selectNodeContents(h1);

    const anchorRange = highlightRangeFromSelection(doc, blocks, sel);
    expect(anchorRange).toEqual({
      spine: 0,
      startBlock: 0,
      startOffset: 0,
      endBlock: 0,
      endOffset: 'The Beginning'.length,
    });
    const resolved = rangeForHighlight(doc, blocks, anchorRange!);
    expect(resolved!.toString()).toBe('The Beginning');
  });

  it('round-trips a selection spanning two blocks', () => {
    const doc = docWith('<p>first paragraph text</p><p>second paragraph text</p>');
    const blocks = blockElements(doc);
    const [p1, p2] = blocks;
    const startOffset = p1!.textContent!.indexOf('paragraph');
    const endOffset = 'second '.length;

    const sel = doc.createRange();
    const startPoint = locateOffset(p1!, doc, startOffset)!;
    const endPoint = locateOffset(p2!, doc, endOffset)!;
    sel.setStart(startPoint.node, startPoint.offset);
    sel.setEnd(endPoint.node, endPoint.offset);

    const anchorRange = highlightRangeFromSelection(doc, blocks, sel);
    expect(anchorRange).toEqual({
      spine: 0,
      startBlock: 0,
      startOffset,
      endBlock: 1,
      endOffset,
    });
    const resolved = rangeForHighlight(doc, blocks, anchorRange!);
    expect(resolved!.toString()).toBe('paragraph text' + 'second ');
  });

  it('returns null when the selection endpoints are outside any known block', () => {
    const doc = docWith('<p>hello</p>');
    const range = doc.createRange();
    range.selectNodeContents(doc.body);
    // no blocks passed -> nothing contains the range endpoints
    expect(highlightRangeFromSelection(doc, [], range)).toBeNull();
  });

  it('rangeForHighlight returns null when a stored block index no longer exists', () => {
    const doc = docWith('<p>only one</p>');
    const blocks = blockElements(doc);
    expect(
      rangeForHighlight(doc, blocks, {
        spine: 0,
        startBlock: 5,
        startOffset: 0,
        endBlock: 5,
        endOffset: 1,
      }),
    ).toBeNull();
  });
});
