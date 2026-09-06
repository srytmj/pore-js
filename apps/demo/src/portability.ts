import type { Bookmark, HighlightRecord, Position } from '@pore/reader-core';

/** One book's portable annotation set. `position` is the resume checkpoint. */
export interface PortableBook {
  id: string;
  title: string;
  position?: Position | null;
  highlights: HighlightRecord[];
  bookmarks: Bookmark[];
}

export const PORTABILITY_FORMAT = 'pore.js/annotations';
export const PORTABILITY_VERSION = 1;

export interface PortabilityBundle {
  format: typeof PORTABILITY_FORMAT;
  version: typeof PORTABILITY_VERSION;
  exportedAt: number;
  books: PortableBook[];
}

export function buildBundle(books: PortableBook[]): PortabilityBundle {
  return {
    format: PORTABILITY_FORMAT,
    version: PORTABILITY_VERSION,
    exportedAt: Date.now(),
    books: books.map((b) => ({
      id: b.id,
      title: b.title,
      position: b.position ?? null,
      highlights: b.highlights,
      bookmarks: b.bookmarks,
    })),
  };
}

export type ValidationResult =
  | { ok: true; bundle: PortabilityBundle }
  | { ok: false; error: string };

/** Structural validation — enough to trust a merge, not a full schema. */
export function validateBundle(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Not a JSON object.' };
  const b = raw as Record<string, unknown>;
  if (b.format !== PORTABILITY_FORMAT)
    return { ok: false, error: `Unrecognised format: ${String(b.format)}` };
  if (b.version !== PORTABILITY_VERSION)
    return { ok: false, error: `Unsupported version: ${String(b.version)} (expected ${PORTABILITY_VERSION})` };
  if (!Array.isArray(b.books)) return { ok: false, error: 'Missing "books" array.' };
  for (const [i, book] of (b.books as unknown[]).entries()) {
    if (typeof book !== 'object' || book === null)
      return { ok: false, error: `books[${i}] is not an object.` };
    const bk = book as Record<string, unknown>;
    if (typeof bk.id !== 'string' || !bk.id)
      return { ok: false, error: `books[${i}].id is missing.` };
    if (!Array.isArray(bk.highlights) || !Array.isArray(bk.bookmarks))
      return { ok: false, error: `books[${i}] is missing highlights/bookmarks arrays.` };
  }
  return { ok: true, bundle: raw as PortabilityBundle };
}

export interface MergeReport {
  books: number;
  highlights: number;
  bookmarks: number;
  skipped: number;
}

function mergeById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  overwrite: boolean,
): { merged: T[]; added: number; skipped: number } {
  const byId = new Map(existing.map((x) => [x.id, x]));
  let added = 0;
  let skipped = 0;
  for (const item of incoming) {
    if (byId.has(item.id)) {
      if (overwrite) byId.set(item.id, item);
      else skipped++;
    } else {
      byId.set(item.id, item);
      added++;
    }
  }
  return { merged: [...byId.values()], added, skipped };
}

/**
 * Merge an imported bundle into the local per-book sets. Existing entries with
 * the same id are kept unless `overwrite`. Returns the new per-book sets plus a
 * report of what changed.
 */
export function mergeBundle(
  existing: PortableBook[],
  incoming: PortabilityBundle,
  opts: { overwrite?: boolean } = {},
): { merged: PortableBook[]; report: MergeReport } {
  const overwrite = opts.overwrite ?? false;
  const byId = new Map(existing.map((b) => [b.id, b]));
  const report: MergeReport = { books: 0, highlights: 0, bookmarks: 0, skipped: 0 };

  for (const book of incoming.books) {
    const prev = byId.get(book.id);
    if (!prev) report.books++;
    const hs = mergeById(prev?.highlights ?? [], book.highlights, overwrite);
    const bs = mergeById(prev?.bookmarks ?? [], book.bookmarks, overwrite);
    report.highlights += hs.added;
    report.bookmarks += bs.added;
    report.skipped += hs.skipped + bs.skipped;
    byId.set(book.id, {
      id: book.id,
      title: book.title || prev?.title || book.id,
      position: overwrite ? (book.position ?? prev?.position ?? null) : (prev?.position ?? book.position ?? null),
      highlights: hs.merged,
      bookmarks: bs.merged,
    });
  }

  return { merged: [...byId.values()], report };
}

/** Trigger a client-side download of a JSON bundle — Blob + object URL, no backend. */
export function downloadBundle(bundle: PortabilityBundle, filename: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
