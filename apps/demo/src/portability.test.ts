import { describe, expect, it } from 'vitest';
import {
  buildBundle,
  mergeBundle,
  validateBundle,
  type PortableBook,
} from './portability.js';

const hl = (id: string) => ({
  id,
  kind: 'text' as const,
  color: '#ff0',
  text: `quote ${id}`,
  createdAt: 1,
  range: {} as never,
  cfi: { start: 'epubcfi(/2)', end: 'epubcfi(/4)' },
});
const bm = (id: string) => ({
  id,
  position: { type: 'page' as const, page: 2 } as never,
  page: 2,
  percent: 0.2,
  label: `mark ${id}`,
  createdAt: 1,
});

const book = (id: string, hls: string[], bms: string[]): PortableBook => ({
  id,
  title: id.toUpperCase(),
  position: null,
  highlights: hls.map(hl),
  bookmarks: bms.map(bm),
});

describe('portability', () => {
  it('builds a versioned bundle', () => {
    const b = buildBundle([book('a', ['h1'], ['b1'])]);
    expect(b.format).toBe('pore.js/annotations');
    expect(b.version).toBe(1);
    expect(b.books).toHaveLength(1);
    expect(b.books[0]!.position).toBeNull();
  });

  it('rejects the wrong shape', () => {
    expect(validateBundle(null).ok).toBe(false);
    expect(validateBundle({ format: 'other', version: 1, books: [] }).ok).toBe(false);
    expect(validateBundle({ format: 'pore.js/annotations', version: 2, books: [] }).ok).toBe(false);
    expect(
      validateBundle({ format: 'pore.js/annotations', version: 1, books: [{ id: '' }] }).ok,
    ).toBe(false);
  });

  it('accepts a bundle it built', () => {
    const b = buildBundle([book('a', ['h1'], [])]);
    const v = validateBundle(JSON.parse(JSON.stringify(b)));
    expect(v.ok).toBe(true);
  });

  it('merges by id, keeping existing entries unless overwrite', () => {
    const existing = [book('a', ['h1'], ['b1'])];
    const incoming = buildBundle([book('a', ['h1', 'h2'], ['b2']), book('c', ['h9'], [])]);
    const { merged, report } = mergeBundle(existing, incoming);

    const a = merged.find((x) => x.id === 'a')!;
    expect(a.highlights.map((h) => h.id).sort()).toEqual(['h1', 'h2']);
    expect(a.bookmarks.map((h) => h.id).sort()).toEqual(['b1', 'b2']);
    expect(merged.find((x) => x.id === 'c')).toBeTruthy();
    expect(report).toEqual({ books: 1, highlights: 2, bookmarks: 1, skipped: 1 });
  });

  it('round-trips: export → clear → import restores everything', () => {
    const original = [book('a', ['h1', 'h2'], ['b1'])];
    const bundle = JSON.parse(JSON.stringify(buildBundle(original)));
    const v = validateBundle(bundle);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const { merged } = mergeBundle([], v.bundle);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.highlights).toHaveLength(2);
    expect(merged[0]!.bookmarks).toHaveLength(1);
  });
});
