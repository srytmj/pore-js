// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { createTextEngine } from './create-text-engine.js';
import type { ReaderSource } from '../source/types.js';

let seq = 0;
beforeEach(() => {
  seq = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:mock/${++seq}`,
    revokeObjectURL: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());

const CONTAINER = `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const OPF = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Fixture</dc:title></metadata><manifest><item id="c1" href="ch01.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="ch02.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
const NAV = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="ch01.xhtml">Ch 1</a></li><li><a href="ch02.xhtml">Ch 2</a></li></ol></nav></body></html>`;

function epubBlob() {
  return new Blob([
    zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(CONTAINER),
      'OEBPS/content.opf': strToU8(OPF),
      'OEBPS/nav.xhtml': strToU8(NAV),
      'OEBPS/ch01.xhtml': strToU8('<html><body><p>Chapter one text.</p></body></html>'),
      'OEBPS/ch02.xhtml': strToU8('<html><body><p>Chapter two text.</p></body></html>'),
    }),
  ]);
}

function source(): ReaderSource {
  return {
    getManifest: vi.fn(async () => ({ bookId: 'b', type: 'epub' as const, title: 'Fixture' })),
    getPage: vi.fn(),
    getFile: vi.fn(async () => epubBlob()),
    loadProgress: vi.fn(async () => null),
    saveProgress: vi.fn(async () => {}),
  };
}

describe('createTextEngine', () => {
  it('mounts an EPUB, emits ready + toc, renders an iframe', async () => {
    const container = document.createElement('div');
    const engine = createTextEngine({ container, source: source(), bookId: 'b' });
    const ready: unknown[] = [];
    const toc: unknown[] = [];
    engine.on('reader:ready', (p) => ready.push(p));
    engine.on('reader:toc', (p) => toc.push(p.toc));
    await engine.mount();
    expect(ready).toHaveLength(1);
    expect((toc[0] as { label: string }[]).map((t) => t.label)).toEqual(['Ch 1', 'Ch 2']);
    expect(container.querySelector('iframe.pore-text__frame')).toBeTruthy();
    engine.destroy();
  });

  it('rejects a non-EPUB book', async () => {
    const stub = {
      ...source(),
      getManifest: vi.fn(async () => ({
        bookId: 'b',
        type: 'image' as const,
        title: 't',
        direction: 'ltr' as const,
        pageCount: 0,
        pages: [],
      })),
    };
    const engine = createTextEngine({
      container: document.createElement('div'),
      source: stub,
      bookId: 'b',
    });
    await expect(engine.mount()).rejects.toThrow(/not an EPUB/);
  });

  it('setSettings emits settingschange', async () => {
    const container = document.createElement('div');
    const engine = createTextEngine({ container, source: source(), bookId: 'b' });
    const seen: Array<{ fontSizePct: number }> = [];
    engine.on('reader:settingschange', (p) => seen.push(p.settings));
    await engine.mount();
    engine.setSettings({ fontSizePct: 130 });
    expect(seen.at(-1)?.fontSizePct).toBe(130);
    engine.destroy();
  });
});
