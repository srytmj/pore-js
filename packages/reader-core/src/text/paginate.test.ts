import { describe, expect, it } from 'vitest';
import { buildBaseStylesheet, computeTextLayout, offsetForPage, pageCountFor } from './paginate.js';

describe('computeTextLayout', () => {
  it('caps the measure and centres it on a wide viewport', () => {
    const l = computeTextLayout({
      viewportWidth: 1600,
      viewportHeight: 900,
      columns: 1,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 100,
    });
    expect(l.measure).toBeLessThanOrEqual(33 * 16 + 1); // ~528px cap at 100%
    expect(l.colsPerPage).toBe(1);
    expect(l.sidePad).toBeGreaterThan(300); // lots of gutter on a 1600px window
    expect(l.pageStep).toBe(l.measure + l.columnGap);
  });

  it('honours a 2-column setting when it fits', () => {
    const l = computeTextLayout({
      viewportWidth: 1400,
      viewportHeight: 900,
      columns: 2,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 100,
    });
    expect(l.colsPerPage).toBe(2);
    expect(l.pageStep).toBe(2 * (l.measure + l.columnGap));
  });

  it('drops to 1 column on a narrow viewport even if 2 is requested', () => {
    const l = computeTextLayout({
      viewportWidth: 600,
      viewportHeight: 900,
      columns: 2,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 100,
    });
    expect(l.colsPerPage).toBe(1);
  });

  it('grows the measure cap with font size', () => {
    const base = computeTextLayout({
      viewportWidth: 2000,
      viewportHeight: 900,
      columns: 1,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 100,
    });
    const big = computeTextLayout({
      viewportWidth: 2000,
      viewportHeight: 900,
      columns: 1,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 160,
    });
    expect(big.measure).toBeGreaterThan(base.measure);
  });
});

describe('pageCountFor / offsetForPage', () => {
  it('divides laid-out width by the page step', () => {
    expect(pageCountFor(0, 800)).toBe(1);
    expect(pageCountFor(2400, 800)).toBe(3);
  });
  it('translates by page step, non-positive, zero for page 0', () => {
    expect(offsetForPage(0, 848)).toBe(0);
    expect(offsetForPage(3, 848)).toBe(-2544);
  });
});

describe('computeTextLayout — vertical', () => {
  it('drops multicol and steps by a full viewport-width slice', () => {
    const l = computeTextLayout({
      viewportWidth: 1000,
      viewportHeight: 700,
      columns: 2,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 100,
      vertical: true,
    });
    expect(l.vertical).toBe(true);
    expect(l.colsPerPage).toBe(1);
    expect(l.pageStep).toBe(l.contentWidth);
    expect(l.contentWidth).toBe(1000 - 40); // viewport minus min side gutters
  });

  it('emits writing-mode:vertical-rl and a right-pinned flow, no column-width', () => {
    const l = computeTextLayout({
      viewportWidth: 900,
      viewportHeight: 700,
      columns: 1,
      columnGap: 40,
      marginPct: 5,
      fontSizePct: 100,
      vertical: true,
    });
    const css = buildBaseStylesheet(l, {
      fontSizePct: 100,
      lineHeight: 1.7,
      textAlign: 'start',
      fontFamily: 'original',
      direction: 'rtl',
      publisherStyles: true,
    });
    expect(css).toContain('writing-mode:vertical-rl');
    expect(css).toContain('justify-content:flex-end');
    expect(css).not.toContain('column-width:');
  });
});

describe('buildBaseStylesheet — flow mode', () => {
  it('makes the viewport a vertical scroller and drops the multicol transform', () => {
    const l = computeTextLayout({
      viewportWidth: 900,
      viewportHeight: 700,
      columns: 1,
      columnGap: 40,
      marginPct: 5,
      fontSizePct: 100,
    });
    const css = buildBaseStylesheet(l, {
      fontSizePct: 100,
      lineHeight: 1.6,
      textAlign: 'start',
      fontFamily: 'original',
      direction: 'ltr',
      publisherStyles: true,
      flow: true,
    });
    expect(css).toContain('overflow-y:auto');
    expect(css).toContain('transform:none');
    expect(css).not.toContain('column-width:');
    expect(css).not.toContain('will-change:transform');
  });
});

describe('buildBaseStylesheet', () => {
  it('emits fixed html gutters and a body multicol surface', () => {
    const layout = computeTextLayout({
      viewportWidth: 1200,
      viewportHeight: 800,
      columns: 1,
      columnGap: 48,
      marginPct: 6,
      fontSizePct: 120,
    });
    const css = buildBaseStylesheet(layout, {
      fontSizePct: 120,
      lineHeight: 1.6,
      textAlign: 'justify',
      fontFamily: 'serif',
      color: '#111',
      background: '#fff',
      direction: 'ltr',
      publisherStyles: true,
    });
    expect(css).toContain(`padding:${layout.marginV}px 0`);
    expect(css).toContain(`width:${layout.contentWidth}px`);
    expect(css).toContain(`column-width:${layout.measure}px`);
    expect(css).toContain('font-size:120%');
    expect(css).toContain('text-align:justify');
    expect(css).toContain('#pore-flow');
  });

  it('forces the font family only when publisher styles are off', () => {
    const layout = computeTextLayout({
      viewportWidth: 1000,
      viewportHeight: 800,
      columns: 1,
      columnGap: 40,
      marginPct: 5,
      fontSizePct: 100,
    });
    const on = buildBaseStylesheet(layout, {
      fontSizePct: 100,
      lineHeight: 1.5,
      textAlign: 'start',
      fontFamily: 'sans',
      direction: 'ltr',
      publisherStyles: true,
    });
    const off = buildBaseStylesheet(layout, {
      fontSizePct: 100,
      lineHeight: 1.5,
      textAlign: 'start',
      fontFamily: 'sans',
      direction: 'ltr',
      publisherStyles: false,
    });
    expect(on).not.toContain('!important');
    expect(off).toContain('font-family');
    expect(off).toContain('!important');
  });
});
