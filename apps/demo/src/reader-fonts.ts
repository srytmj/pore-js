// The reading iframe is a separate document — the app's own @font-face rules
// don't reach it. Build a minimal @font-face sheet from the bundled (same-origin)
// woff2 files and hand it to <Reader fontFaceCss>, so the Serif / Sans
// typography options resolve to Literata / Hanken Grotesk in the reader.
import literataRoman from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url';
import literataItalic from '@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url';
import hankenRoman from '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url';
import hankenItalic from '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-italic.woff2?url';

export const readerFontFaceCss = `
@font-face {
  font-family: 'Literata';
  font-style: normal;
  font-weight: 200 900;
  font-display: swap;
  src: url(${literataRoman}) format('woff2-variations');
}
@font-face {
  font-family: 'Literata';
  font-style: italic;
  font-weight: 200 900;
  font-display: swap;
  src: url(${literataItalic}) format('woff2-variations');
}
@font-face {
  font-family: 'Hanken Grotesk';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${hankenRoman}) format('woff2-variations');
}
@font-face {
  font-family: 'Hanken Grotesk';
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
  src: url(${hankenItalic}) format('woff2-variations');
}
`;
