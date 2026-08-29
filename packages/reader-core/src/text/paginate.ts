export interface BaseStyleOptions {
  pageWidth: number;
  pageHeight: number;
  columnGap: number;
  /** Body padding in px (the reading margin). */
  margin: number;
  fontSizePct: number;
  lineHeight: number;
  textAlign: 'start' | 'justify';
  color?: string;
  background?: string;
  direction: 'ltr' | 'rtl';
}

/** Page count for a spine doc given its laid-out width. */
export function pageCountFor(scrollWidth: number, pageWidth: number): number {
  if (pageWidth <= 0) return 1;
  return Math.max(1, Math.round(scrollWidth / pageWidth));
}

/** X translate (px, negative) that brings `page` (0-based) into view. */
export function offsetForPage(page: number, pageWidth: number, columnGap: number): number {
  return page <= 0 ? 0 : -page * (pageWidth + columnGap);
}

/**
 * Base stylesheet injected into every spine iframe. Low-specificity element
 * selectors so deliberate author styling still wins; the multicol lives on
 * `body` and pagination translates `body`.
 */
export function buildBaseStylesheet(o: BaseStyleOptions): string {
  const colWidth = Math.max(1, o.pageWidth - o.margin * 2);
  return `
html { margin:0; padding:0; height:${o.pageHeight}px; overflow:hidden; ${
    o.background ? `background:${o.background};` : ''
  } }
body {
  margin:0;
  padding:${o.margin}px;
  height:${o.pageHeight - o.margin * 2}px;
  column-width:${colWidth}px;
  column-gap:${o.columnGap}px;
  column-fill:auto;
  font-size:${o.fontSizePct}%;
  line-height:${o.lineHeight};
  text-align:${o.textAlign};
  direction:${o.direction};
  ${o.color ? `color:${o.color};` : ''}
  transform:translateX(0);
  will-change:transform;
}
p, li, blockquote, div { text-align:inherit; }
img, svg, video { max-width:100%; max-height:${o.pageHeight - o.margin * 2}px; height:auto; break-inside:avoid; }
table, pre { max-width:100%; overflow-x:auto; break-inside:avoid; }
a { color:inherit; }
`.trim();
}
