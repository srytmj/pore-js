import { describe, expect, it, vi } from 'vitest';
import { createReaderSource, readerSourceKey } from './create-reader-source.js';

const png = new Uint8Array([137, 80, 78, 71]);

describe('createReaderSource — pages', () => {
  it('builds an image manifest from a URL list + metadata', async () => {
    const src = createReaderSource({
      pages: ['https://cdn/a/1.webp', 'https://cdn/a/2.webp', 'https://cdn/a/3.webp'],
      meta: { title: 'One Piece', author: 'Oda', volume: 108, direction: 'rtl' },
    });
    const m = await src.getManifest('x');
    expect(m.type).toBe('image');
    if (m.type !== 'image') return;
    expect(m).toMatchObject({ title: 'One Piece', subtitle: 'Oda', volume: 108, direction: 'rtl' });
    expect(m.pageCount).toBe(3);
  });

  it('returns the raw URL from getPage when no fetcher is given', async () => {
    const src = createReaderSource({ pages: ['https://cdn/x/1.jpg'] });
    await expect(src.getPage('x', 0)).resolves.toBe('https://cdn/x/1.jpg');
  });

  it('fetches to a Blob when a custom fetcher is given (CDN auth)', async () => {
    const fetcher = vi.fn(async () => new Response(png, { status: 200 }));
    const src = createReaderSource({ pages: ['https://cdn/x/1.jpg'], fetch: fetcher });
    const page = await src.getPage('x', 0);
    expect(page).toBeInstanceOf(Blob);
    expect(fetcher).toHaveBeenCalledWith('https://cdn/x/1.jpg', undefined);
  });

  it('range-checks', async () => {
    const src = createReaderSource({ pages: ['https://cdn/x/1.jpg'] });
    await expect(src.getPage('x', 5)).rejects.toThrow(/out of range/);
  });

  it('threads progress in and out', async () => {
    const onProgress = vi.fn();
    const src = createReaderSource({
      pages: ['a', 'b'],
      initialProgress: { type: 'page', page: 1 } as never,
      onProgress,
    });
    expect(await src.loadProgress('x')).toMatchObject({ page: 1 });
    await src.saveProgress('x', { type: 'page', page: 2 } as never);
    expect(onProgress).toHaveBeenCalledWith({ type: 'page', page: 2 });
  });
});

describe('createReaderSource — src / file', () => {
  it('fetches an archive URL and detects the type from the name', async () => {
    const zip = new Uint8Array([80, 75, 3, 4]); // "PK\x03\x04"
    const fetcher = vi.fn(async () => new Response(zip, { status: 200 }));
    const src = createReaderSource({
      src: 'https://cdn/one-piece/ch-1074.cbz?token=abc',
      meta: { title: 'One Piece' },
      fetch: fetcher,
    });
    // getManifest triggers the fetch + parse
    await src.getManifest('x').catch(() => {}); // empty zip → LocalFileSource yields 0 pages, not an error
    expect(fetcher).toHaveBeenCalledWith('https://cdn/one-piece/ch-1074.cbz?token=abc');
  });

  it('accepts a Blob directly', async () => {
    const src = createReaderSource({
      file: new Blob([png], { type: 'image/png' }),
      name: 'page.png',
    });
    const m = await src.getManifest('x');
    expect(m.type).toBe('image');
  });

  it('rejects an empty input up front', () => {
    expect(() => createReaderSource({})).toThrow(/one of .src., .pages., or .file./);
  });
});

describe('readerSourceKey', () => {
  it('is stable per distinct input', () => {
    expect(readerSourceKey({ src: 'a.cbz' })).toBe('a.cbz');
    expect(readerSourceKey({ pages: ['a', 'b'] })).toBe('pages:2:a');
    expect(readerSourceKey({ name: 'x' })).toBe('x');
  });
});
