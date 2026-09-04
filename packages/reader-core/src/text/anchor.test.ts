// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  blockElements,
  generateAnchor,
  offsetForVisibleWord,
  pageForElement,
  rangeAtOffset,
  resolveAnchor,
} from './anchor.js';
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
  const opts = { spinePages: 10, pageStep: 840 };

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

describe('offsetForVisibleWord', () => {
  it('finds the character offset of the first word on the visible page', () => {
    const doc = docWith('<p>alpha beta gamma delta epsilon</p>');
    const p = doc.querySelector('p')!;
    // pretend "gamma" (offset 11) is the first word past a page boundary at x=100
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    let call = 0;
    const rangeRectOf = () => {
      const w = words[call++];
      const x = w === 'gamma' || w === 'delta' || w === 'epsilon' ? 150 : 10;
      return { left: x, right: x + 40, top: 0, bottom: 20 };
    };
    const offset = offsetForVisibleWord(p, doc, (r) => r.left >= 100, rangeRectOf);
    expect(p.textContent!.slice(offset, offset + 5)).toBe('gamma');
  });

  it('returns 0 when no word matches (no layout signal, e.g. jsdom)', () => {
    const doc = docWith('<p>alpha beta</p>');
    const p = doc.querySelector('p')!;
    expect(offsetForVisibleWord(p, doc, () => false)).toBe(0);
  });

  it('walks across nested inline markup (em/strong/a) as one flattened text', () => {
    const doc = docWith('<p>alpha <em>beta</em> <strong><a href="#">gamma</a></strong> delta</p>');
    const p = doc.querySelector('p')!;
    const full = p.textContent!; // "alpha beta gamma delta"
    const target = full.indexOf('gamma');
    let call = 0;
    const rangeRectOf = () => ({ left: call++ === 2 ? 200 : 0, right: 40, top: 0, bottom: 20 });
    const offset = offsetForVisibleWord(p, doc, (r) => r.left >= 100, rangeRectOf);
    expect(offset).toBe(target);
  });
});

describe('rangeAtOffset', () => {
  it('locates the text node + local offset for a flattened offset', () => {
    const doc = docWith('<p>alpha <em>beta</em> gamma</p>');
    const p = doc.querySelector('p')!;
    // "alpha beta gamma" -> offset 6 is "b" of "beta", inside the <em>
    const range = rangeAtOffset(p, doc, 6)!;
    expect(range).not.toBeNull();
    expect(range.startContainer.textContent).toBe('beta');
    expect(range.startOffset).toBe(0);
  });

  it('returns null past the end of the block text', () => {
    const doc = docWith('<p>hi</p>');
    expect(rangeAtOffset(doc.querySelector('p')!, doc, 99)).toBeNull();
  });
});

describe('generateAnchor — offset precision', () => {
  it('records which word starts the page when a block spans multiple pages', () => {
    const doc = docWith('<p>alpha beta gamma delta</p>');
    const blocks = blockElements(doc);
    const rectOf = () => ({ left: 0, right: 780, top: 0, bottom: 400 }); // block "visible"
    // alpha/beta belong to the *previous* page (scrolled off to the left after
    // the page transform, so `right` goes negative too); gamma/delta are on
    // the currently-visible page.
    const words = ['alpha', 'beta', 'gamma', 'delta'];
    let call = 0;
    const rangeRectOf = () => {
      const w = words[call++];
      const x = w === 'gamma' || w === 'delta' ? 50 : -800;
      return { left: x, right: x + 40, top: 0, bottom: 20 };
    };
    const a = generateAnchor(
      doc,
      { spine: 0, page: 1, spinePages: 2, bookPercent: 0.5, pageWidth: 800 },
      rectOf,
      rangeRectOf,
    );
    expect(a.type).toBe('anchor');
    if (a.type === 'anchor') {
      expect(blocks[0]!.textContent!.slice(a.offset, a.offset + 5)).toBe('gamma');
    }
  });
});

describe('resolveAnchor — offset precision', () => {
  const opts = { spinePages: 10, pageStep: 840 };

  it('uses the word offset to land on a later page than the block start', () => {
    const doc = docWith('<p>alpha beta gamma delta</p>');
    const rectOf = () => ({ left: 0, right: 780, top: 0, bottom: 400 }); // block starts page 0
    const rangeRectOf = () => ({ left: 1680, right: 1720, top: 0, bottom: 20 }); // word is on page 2
    const anchor: Extract<Position, { type: 'anchor' }> = {
      type: 'anchor',
      spine: 0,
      block: 0,
      offset: 12, // "gamma"
      percent: 0.5,
    };
    const r = resolveAnchor(doc, anchor, opts, rectOf, rangeRectOf);
    expect(r).toEqual({ page: 2, exact: true });
  });

  it('falls back to the whole-block page when the range has no layout signal', () => {
    const doc = docWith('<p>alpha beta gamma</p>');
    const rectOf = () => ({ left: 840, right: 1620, top: 0, bottom: 400 }); // block on page 1
    const anchor: Extract<Position, { type: 'anchor' }> = {
      type: 'anchor',
      spine: 0,
      block: 0,
      offset: 6,
      percent: 0.5,
    };
    // no rangeRectOf passed -> defaults to real getBoundingClientRect, which
    // jsdom doesn't implement for Range -> treated as "no signal"
    const r = resolveAnchor(doc, anchor, opts, rectOf);
    expect(r).toEqual({ page: 1, exact: true });
  });
});

describe('pageForElement', () => {
  it('divides left by the page step', () => {
    const el = docWith('<p>x</p>').querySelector('p')!;
    expect(pageForElement(el, 840, () => ({ left: 2520, right: 3000, top: 0, bottom: 10 }))).toBe(
      3,
    );
  });
});
