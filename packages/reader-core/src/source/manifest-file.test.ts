import { describe, expect, it } from 'vitest';
import { naturalCompare, parseImageManifestFile } from './manifest-file.js';

const URL_BASE = 'https://demo.test/fixtures/book/manifest.json';

describe('naturalCompare', () => {
  it('orders numerically', () => {
    expect(['p10.svg', 'p2.svg', 'p1.svg'].sort(naturalCompare)).toEqual([
      'p1.svg',
      'p2.svg',
      'p10.svg',
    ]);
  });
});

describe('parseImageManifestFile', () => {
  it('normalises a minimal manifest and resolves relative page urls', () => {
    const { manifest, pageUrls } = parseImageManifestFile(
      { title: 'Book', direction: 'rtl', pages: [{ src: '01.svg' }, { src: '02.svg' }] },
      { bookId: 'book', manifestUrl: URL_BASE },
    );
    expect(manifest.type).toBe('image');
    expect(manifest.direction).toBe('rtl');
    expect(manifest.pageCount).toBe(2);
    expect(manifest.pages[0]).toEqual({ index: 0 });
    expect(pageUrls).toEqual([
      'https://demo.test/fixtures/book/01.svg',
      'https://demo.test/fixtures/book/02.svg',
    ]);
  });

  it('derives isWide from aspect ratio', () => {
    const { manifest } = parseImageManifestFile(
      {
        pages: [
          { src: 'a.svg', width: 800, height: 1200 },
          { src: 'b.svg', width: 1600, height: 1200 },
        ],
      },
      { bookId: 'b', manifestUrl: URL_BASE },
    );
    expect(manifest.pages[0]?.isWide).toBe(false);
    expect(manifest.pages[1]?.isWide).toBe(true);
  });

  it('honours an explicit isWide over aspect', () => {
    const { manifest } = parseImageManifestFile(
      { pages: [{ src: 'a.svg', width: 1600, height: 1200, isWide: false }] },
      { bookId: 'b', manifestUrl: URL_BASE },
    );
    expect(manifest.pages[0]?.isWide).toBe(false);
  });

  it('defaults an unknown direction to ltr', () => {
    const { manifest } = parseImageManifestFile(
      { direction: 'sideways' as unknown as 'ltr', pages: [{ src: 'a.svg' }] },
      { bookId: 'b', manifestUrl: URL_BASE },
    );
    expect(manifest.direction).toBe('ltr');
  });

  it('throws on a missing pages array', () => {
    expect(() => parseImageManifestFile({}, { bookId: 'b', manifestUrl: URL_BASE })).toThrow(
      /malformed/,
    );
  });

  it('throws on a page without src', () => {
    expect(() =>
      parseImageManifestFile({ pages: [{ src: '' }] }, { bookId: 'b', manifestUrl: URL_BASE }),
    ).toThrow(/no src/);
  });
});
