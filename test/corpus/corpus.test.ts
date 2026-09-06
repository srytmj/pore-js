import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Runs the engines' parsing + CFI + search layers against the **real** books in
 * `test/corpus/files/` (populated by `scripts/fetch-corpus.mjs`). Full
 * pagination needs a browser and is covered by the e2e suites; this catches
 * "chokes on a real publisher's OPF / PDF" regressions.
 *
 * Runs in `pnpm test` and `pnpm test:corpus`, but **skips cleanly** unless the
 * corpus has been downloaded (so it never blocks CI's unit job or a fresh
 * clone). `porejs` is imported dynamically so a missing `dist/` doesn't error.
 */
const here = join(process.cwd(), 'test/corpus'); // `pnpm test` runs from the repo root
const filesDir = join(here, 'files');
const sources: { books: { id: string; kind: string; title: string }[] } = JSON.parse(
  readFileSync(join(here, 'sources.json'), 'utf8'),
);

const filePath = (id: string, kind: string) =>
  join(filesDir, `${id}.${kind === 'pdf' ? 'pdf' : 'epub'}`);
const present = sources.books.filter((b) => existsSync(filePath(b.id, b.kind)));

import type * as PorejsApi from '../../packages/reader-core/dist/index.js';

let api: typeof PorejsApi;

describe.skipIf(present.length === 0)('real-book corpus', () => {
  beforeAll(async () => {
    api = await import('../../packages/reader-core/dist/index.js');
  });

  for (const book of present) {
    const bytes = () => new Uint8Array(readFileSync(filePath(book.id, book.kind)));

    if (book.kind === 'epub') {
      describe(book.title, () => {
        it('has a sane spine + metadata and resolves every spine href', () => {
          const epub = api.parseEpub(bytes());
          expect(epub.spine.length).toBeGreaterThan(0);
          expect(epub.metadata.title ?? '').not.toBe('');
          expect(epub.entries.length).toBeGreaterThan(epub.spine.length);
          for (const item of epub.spine) {
            expect(epub.resource(item.href), item.href).not.toBeNull();
          }
        });

        it('round-trips a CFI against a real spine document', () => {
          const epub = api.parseEpub(bytes());
          const first = epub.resource(epub.spine[0]!.href)!;
          const doc = new DOMParser().parseFromString(
            new TextDecoder().decode(first.bytes),
            'application/xhtml+xml',
          );
          const el =
            doc.body?.querySelector('p, h1, h2, div, span') ?? doc.body?.firstElementChild;
          expect(el, 'a resolvable element in the first spine doc').toBeTruthy();
          const cfi = api.serializeCfi(0, el as Element, 0);
          const parsed = api.parseCfi(cfi);
          expect(parsed).not.toBeNull();
          expect(api.resolveCfiElement(doc, parsed!.steps)).toBe(el);
        });

        it('builds a search index over the real text', async () => {
          const epub = api.parseEpub(bytes());
          const sc = new api.SearchController({ workerFactory: false });
          const sections = epub.spine.slice(0, 8).map((item, index) => {
            const r = epub.resource(item.href)!;
            const d = new DOMParser().parseFromString(
              new TextDecoder().decode(r.bytes),
              'application/xhtml+xml',
            );
            return { id: item.href, index, text: d.body?.textContent ?? '' };
          });
          await sc.build(sections);
          expect(Array.isArray(await sc.query('the', { limit: 5 }))).toBe(true);
          sc.destroy();
        });
      });
    } else {
      describe(book.title, () => {
        it('loads and reports pages + outline', async () => {
          const pdf = await api.loadPdf(bytes());
          expect(pdf.pageCount).toBeGreaterThan(0);
          const size = await pdf.pageSize(1);
          expect(size.width).toBeGreaterThan(0);
          expect(size.height).toBeGreaterThan(0);
          expect(Array.isArray(pdf.outline)).toBe(true);
        });
      });
    }
  }
});
