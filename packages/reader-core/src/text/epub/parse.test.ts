// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseEpub } from './parse.js';

const CONTAINER = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

function opf(opts: { nav?: boolean; ncx?: boolean; ppd?: string; fixed?: boolean } = {}) {
  return `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>A. Writer</dc:creator>
    ${opts.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}
  </metadata>
  <manifest>
    <item id="c1" href="ch01.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="ch02.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${opts.nav ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : ''}
    ${opts.ncx ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : ''}
  </manifest>
  <spine ${opts.ncx ? 'toc="ncx"' : ''} ${opts.ppd ? `page-progression-direction="${opts.ppd}"` : ''}>
    <itemref idref="c1"/>
    <itemref idref="c2" linear="no"/>
  </spine>
</package>`;
}

const NAV = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body><nav epub:type="toc"><ol>
    <li><a href="ch01.xhtml">One</a><ol><li><a href="ch01.xhtml#s2">One.b</a></li></ol></li>
    <li><a href="ch02.xhtml">Two</a></li>
  </ol></nav></body>
</html>`;

const NCX = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint><navLabel><text>One</text></navLabel><content src="ch01.xhtml"/></navPoint>
    <navPoint><navLabel><text>Two</text></navLabel><content src="ch02.xhtml"/></navPoint>
  </navMap>
</ncx>`;

function build(files: Record<string, string>) {
  const zip: Record<string, Uint8Array> = { mimetype: strToU8('application/epub+zip') };
  for (const [k, v] of Object.entries(files)) zip[k] = strToU8(v);
  return zipSync(zip);
}

describe('parseEpub', () => {
  it('parses metadata, spine order and linear flags', () => {
    const book = parseEpub(
      build({
        'META-INF/container.xml': CONTAINER,
        'OEBPS/content.opf': opf({ nav: true }),
        'OEBPS/nav.xhtml': NAV,
        'OEBPS/ch01.xhtml': '<html><body>1</body></html>',
        'OEBPS/ch02.xhtml': '<html><body>2</body></html>',
        'OEBPS/style.css': 'p{}',
      }),
    );
    expect(book.metadata.title).toBe('Test Book');
    expect(book.metadata.language).toBe('en');
    expect(book.spine.map((s) => s.href)).toEqual(['OEBPS/ch01.xhtml', 'OEBPS/ch02.xhtml']);
    expect(book.spine[1]?.linear).toBe(false);
  });

  it('builds a nested TOC tree from EPUB3 nav', () => {
    const book = parseEpub(
      build({
        'META-INF/container.xml': CONTAINER,
        'OEBPS/content.opf': opf({ nav: true }),
        'OEBPS/nav.xhtml': NAV,
        'OEBPS/ch01.xhtml': 'x',
        'OEBPS/ch02.xhtml': 'x',
      }),
    );
    expect(book.toc.map((t) => t.label)).toEqual(['One', 'Two']);
    expect(book.toc[0]?.children[0]?.label).toBe('One.b');
    expect(book.toc[0]?.children[0]?.href).toBe('OEBPS/ch01.xhtml#s2');
  });

  it('falls back to the EPUB2 ncx', () => {
    const book = parseEpub(
      build({
        'META-INF/container.xml': CONTAINER,
        'OEBPS/content.opf': opf({ ncx: true }),
        'OEBPS/toc.ncx': NCX,
        'OEBPS/ch01.xhtml': 'x',
        'OEBPS/ch02.xhtml': 'x',
      }),
    );
    expect(book.toc.map((t) => t.label)).toEqual(['One', 'Two']);
  });

  it('resolves resources and reads page-progression-direction + fixed layout', () => {
    const book = parseEpub(
      build({
        'META-INF/container.xml': CONTAINER,
        'OEBPS/content.opf': opf({ ppd: 'rtl', fixed: true }),
        'OEBPS/ch01.xhtml': 'x',
        'OEBPS/ch02.xhtml': 'x',
        'OEBPS/style.css': 'p{color:red}',
      }),
    );
    expect(book.metadata.direction).toBe('rtl');
    expect(book.metadata.fixedLayout).toBe(true);
    const css = book.resource('style.css');
    expect(css?.mediaType).toBe('text/css');
    expect(new TextDecoder().decode(css!.bytes)).toContain('red');
  });

  it('throws on a missing container', () => {
    expect(() => parseEpub(build({ 'OEBPS/x.opf': '<x/>' }))).toThrow(/container/);
  });
});
