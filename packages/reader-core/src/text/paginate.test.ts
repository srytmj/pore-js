import { describe, expect, it } from 'vitest';
import { buildBaseStylesheet, offsetForPage, pageCountFor } from './paginate.js';

describe('pageCountFor', () => {
  it('divides laid-out width by page width, min 1', () => {
    expect(pageCountFor(0, 800)).toBe(1);
    expect(pageCountFor(2400, 800)).toBe(3);
    expect(pageCountFor(2000, 800)).toBe(3); // rounds
  });
  it('is safe with a zero page width', () => {
    expect(pageCountFor(1000, 0)).toBe(1);
  });
});

describe('offsetForPage', () => {
  it('translates by page width + gap, negative', () => {
    expect(offsetForPage(0, 800, 40)).toBe(0);
    expect(offsetForPage(2, 800, 40)).toBe(-1680);
  });
});

describe('buildBaseStylesheet', () => {
  it('emits column + typography rules from the options', () => {
    const css = buildBaseStylesheet({
      pageWidth: 800,
      pageHeight: 1200,
      columnGap: 48,
      margin: 40,
      fontSizePct: 120,
      lineHeight: 1.6,
      textAlign: 'justify',
      color: '#111',
      background: '#fff',
      direction: 'rtl',
    });
    expect(css).toContain('column-width:720px'); // 800 - 40*2
    expect(css).toContain('column-gap:48px');
    expect(css).toContain('font-size:120%');
    expect(css).toContain('text-align:justify');
    expect(css).toContain('direction:rtl');
  });
});
