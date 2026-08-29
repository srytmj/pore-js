import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { LocalFileSource } from './local-file-source.js';

const png = (n: number) => new Uint8Array([137, 80, 78, 71, n]); // fake but distinct

describe('LocalFileSource — CBZ', () => {
  it('lists image entries in natural order and inflates one per getPage', async () => {
    const zipped = zipSync({
      'p10.png': png(10),
      'p2.png': png(2),
      'p1.png': png(1),
      'notes.txt': new Uint8Array([1]),
      '__MACOSX/p1.png': png(99),
    });
    const file = new File([zipped], 'book.cbz');
    const src = new LocalFileSource([file]);

    const m = await src.getManifest('x');
    expect(m.type).toBe('image');
    if (m.type === 'image') {
      expect(m.pageCount).toBe(3);
      expect(m.title).toBe('book');
    }

    const b0 = await src.getPage('x', 0);
    expect(new Uint8Array(await b0.arrayBuffer())).toEqual(png(1)); // p1.png first
    const b2 = await src.getPage('x', 2);
    expect(new Uint8Array(await b2.arrayBuffer())).toEqual(png(10)); // p10.png last

    await expect(src.getPage('x', 9)).rejects.toThrow(/out of range/);
  });

  it('honours an abort signal', async () => {
    const file = new File([zipSync({ 'a.png': png(1) })], 'b.cbz');
    const src = new LocalFileSource([file]);
    const ac = new AbortController();
    ac.abort();
    await expect(src.getPage('x', 0, { signal: ac.signal })).rejects.toThrow(/Abort/);
  });
});

describe('LocalFileSource — loose images', () => {
  it('sorts dropped image files and serves them directly', async () => {
    const files = [
      new File([png(3)], 'c.jpg'),
      new File([png(1)], 'a.jpg'),
      new File([png(2)], 'b.jpg'),
      new File([new Uint8Array([0])], 'readme.md'),
    ];
    const src = new LocalFileSource(files, { direction: 'rtl' });
    const m = await src.getManifest('x');
    expect(m.type === 'image' && m.pageCount).toBe(3);
    expect(m.type === 'image' && m.direction).toBe('rtl');
    const first = await src.getPage('x', 0);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(png(1));
  });
});
