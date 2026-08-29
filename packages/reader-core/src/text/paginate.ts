export interface TextLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  columns: 1 | 2;
  columnGap: number;
  /** Vertical reading margin as a % of the viewport's smaller dimension. */
  marginPct: number;
  fontSizePct: number;
}

export interface TextLayout {
  /** Width of a single text column (the readable measure), px. */
  measure: number;
  columnGap: number;
  /** Columns shown per page (respects `columns`, drops to 1 if it won't fit). */
  colsPerPage: number;
  /** Fixed left/right gutter on the non-scrolling frame, px. */
  sidePad: number;
  /** Top/bottom reading margin, px. */
  marginV: number;
  /** X distance (px) between consecutive pages. */
  pageStep: number;
  /** Body content-box width, px. */
  contentWidth: number;
  /** Body content-box height, px. */
  contentHeight: number;
}

const MIN_MEASURE = 280;
const MIN_SIDE = 20;

/** Work out a book-like, centred column layout for the given viewport. */
export function computeTextLayout(i: TextLayoutInput): TextLayout {
  const marginV = Math.round((Math.min(i.viewportWidth, i.viewportHeight) * i.marginPct) / 100);
  // a comfortable measure caps around ~66 characters ≈ 33em at the current size
  const maxMeasure = Math.round(33 * 16 * (i.fontSizePct / 100));
  const avail = Math.max(MIN_MEASURE, i.viewportWidth - MIN_SIDE * 2);

  let colsPerPage: 1 | 2 = i.columns;
  let measure = Math.min(
    maxMeasure,
    Math.floor((avail - (colsPerPage - 1) * i.columnGap) / colsPerPage),
  );
  if (colsPerPage === 2 && measure < MIN_MEASURE) {
    colsPerPage = 1;
    measure = Math.min(maxMeasure, avail);
  }
  measure = Math.max(MIN_MEASURE, Math.min(measure, avail));

  const contentWidth = colsPerPage * measure + (colsPerPage - 1) * i.columnGap;
  const sidePad = Math.max(MIN_SIDE, Math.round((i.viewportWidth - contentWidth) / 2));
  const pageStep = colsPerPage * (measure + i.columnGap);

  return {
    measure,
    columnGap: i.columnGap,
    colsPerPage,
    sidePad,
    marginV,
    pageStep,
    contentWidth,
    contentHeight: Math.max(1, i.viewportHeight - marginV * 2),
  };
}

/** Page count for a spine doc given its laid-out width. */
export function pageCountFor(scrollWidth: number, pageStep: number): number {
  if (pageStep <= 0) return 1;
  return Math.max(1, Math.round(scrollWidth / pageStep));
}

/** X translate (px, ≤ 0) that brings 0-based `page` into view. */
export function offsetForPage(page: number, pageStep: number): number {
  return page <= 0 ? 0 : -page * pageStep;
}

export interface TypographyOptions {
  fontSizePct: number;
  lineHeight: number;
  textAlign: 'start' | 'justify';
  fontFamily: 'serif' | 'sans' | 'slab' | 'dyslexic' | 'original';
  color?: string;
  background?: string;
  direction: 'ltr' | 'rtl';
  publisherStyles: boolean;
  /** Invert images (dark theme). */
  dimImages?: boolean;
}

const FONT_STACKS: Record<TypographyOptions['fontFamily'], string> = {
  original: '',
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  slab: "'Roboto Slab', Rockwell, Georgia, serif",
  dyslexic: "'OpenDyslexic', Verdana, sans-serif",
};

export const VIEWPORT_ID = 'pore-viewport';
export const FLOW_ID = 'pore-flow';

/**
 * Base stylesheet for a spine iframe. `body` centres a fixed-width
 * `#${VIEWPORT_ID}` that clips to the reading measure; `#${FLOW_ID}` inside it
 * is the CSS-multicol surface that pagination translates. Low-specificity
 * element selectors so deliberate author styling still wins.
 */
export function buildBaseStylesheet(layout: TextLayout, t: TypographyOptions): string {
  const family = FONT_STACKS[t.fontFamily];
  const forceFamily = family && !t.publisherStyles;
  return `
html, body { margin:0; height:100%; overflow:hidden; }
body {
  display:flex; justify-content:center;
  box-sizing:border-box;
  padding:${layout.marginV}px 0;
  ${t.background ? `background:${t.background};` : ''}
  font-size:${t.fontSizePct}%;
  line-height:${t.lineHeight};
  text-align:${t.textAlign};
  direction:${t.direction};
  ${t.color ? `color:${t.color};` : ''}
  ${family ? `font-family:${family}${forceFamily ? ' !important' : ''};` : ''}
  -webkit-font-smoothing:antialiased;
}
#${VIEWPORT_ID} {
  width:${layout.contentWidth}px;
  max-width:100%;
  height:100%;
  overflow:hidden;
  position:relative;
}
#${FLOW_ID} {
  height:100%;
  column-width:${layout.measure}px;
  column-gap:${layout.columnGap}px;
  column-fill:auto;
  transform:translateX(0);
  will-change:transform;
}
${forceFamily ? `body, body * { font-family:${family} !important; }` : ''}
#${FLOW_ID} p, #${FLOW_ID} li, #${FLOW_ID} blockquote, #${FLOW_ID} div { text-align:inherit; }
#${FLOW_ID} img, #${FLOW_ID} svg, #${FLOW_ID} video { max-width:100%; max-height:${layout.contentHeight}px; height:auto; break-inside:avoid;${
    t.dimImages ? ' filter:invert(1) hue-rotate(180deg);' : ''
  } }
#${FLOW_ID} table, #${FLOW_ID} pre { max-width:100%; overflow-x:auto; break-inside:avoid; }
#${FLOW_ID} a { color:inherit; }
#${FLOW_ID} h1, #${FLOW_ID} h2, #${FLOW_ID} h3 { break-after:avoid; }
${t.publisherStyles ? '' : `#${FLOW_ID} p { margin:0 0 1em; } #${FLOW_ID} h1, #${FLOW_ID} h2, #${FLOW_ID} h3 { margin:1.4em 0 .6em; }`}
`.trim();
}
