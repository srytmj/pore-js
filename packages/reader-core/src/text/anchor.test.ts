// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blockElements, generateAnchor, pageForElement, resolveAnchor } from './anchor.js';
import type { Position } from '../position/types.js';

function docWith(bodyHtml: string): Document {
  return new DOMParser().parseFromString(`<html><body>${bodyHtml}</body></html>`, 'text/html');
}

const PARAS = Array.from(
  { length: 8 },
  (_, i) => `<p>Paragraph number ${i} with some words.</p>`,
).join('');

describe('blockElements', () => {
  it('collects non-empty blocks in document order', () => {
    const doc = docWith('<h1>Title</h1><p>One</p><p>   </p><p>Two</p><img src="x"/>');
    expect(blockElements(doc).map((e) => e.tagName)).toEqual(['H1', 'P', 'P', 'IMG']);
  });
});

describe('generateAnchor', () => {
  it('picks the first block visible in the current column', () => {
    const doc = docWith(PARAS);
    const blocks = blockElements(doc);
    // fake geometry: blocks 0..2 are off to the left, block 3 is in view
    const rectOf = (el: Element) => {
      const idx = blocks.indexOf(el);
      const left = (idx - 3) * 800;
      return { left, right: left + 780, top: 0, bottom: 400 };
    };
    const a = generateAnchor(
      doc,
      { spine: 2, page: 3, spinePages: 10, bookPercent: 0.42, pageWidth: 800 },
      rectOf,
    );
    expect(a).toEqual({ type: 'anchor', spine: 2, block: 3, offset: 0, percent: 0.42 });
  });
});

describe('resolveAnchor', () => {
  const opts = { spinePages: 10, pageWidth: 800, columnGap: 40 };

  it('resolves an exact block to its page', () => {
    const doc = docWith(PARAS);
    const blocks = blockElements(doc);
    const rectOf = (el: Element) => {
      const idx = blocks.indexOf(el);
      return { left: idx * 840, right: idx * 840 + 780, top: 0, bottom: 400 };
    };
    const anchor: Extract<Position, { type: 'anchor' }> = {
      type: 'anchor',
      spine: 0,
      block: 5,
      offset: 0,
      percent: 0.3,
    };
    const r = resolveAnchor(doc, anchor, opts, rectOf);
    expect(r).toEqual({ page: 5, exact: true });
  });

  it('falls back to the percentage when the block is gone', () => {
    const doc = docWith('<p>Only one paragraph now.</p>');
    const anchor: Extract<Position, { type: 'anchor' }> = {
      type: 'anchor',
      spine: 0,
      block: 20,
      offset: 0,
      percent: 0.5,
    };
    const r = resolveAnchor(doc, anchor, opts, () => ({ left: 0, right: 100, top: 0, bottom: 10 }));
    // one block exists, so it clamps to it rather than pure %; still not "exact"
    expect(r.exact).toBe(false);
  });
});

describe('pageForElement', () => {
  it('divides left by page width + gap', () => {
    const el = docWith('<p>x</p>').querySelector('p')!;
    expect(
      pageForElement(el, 800, 40, () => ({ left: 2520, right: 3000, top: 0, bottom: 10 })),
    ).toBe(3);
  });
});
