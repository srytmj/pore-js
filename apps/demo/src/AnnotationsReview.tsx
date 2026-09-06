import type { Bookmark, HighlightRecord, Position, ReaderSource } from '@pore/reader-core';
import { useEffect, useMemo, useState } from 'react';
import type { LibraryEntry } from './use-library.js';

export interface JumpTarget {
  bookId: string;
  cfi?: string;
  position?: Position;
}

interface BookGroup {
  entry: LibraryEntry;
  highlights: HighlightRecord[];
  bookmarks: Bookmark[];
}

/**
 * A full-screen "everything you've marked" overlay, reachable from the landing.
 * Reads the per-book highlight / bookmark stores straight off the shared source
 * — no aggregate API in core. Only sample books (which all share the demo
 * source) are covered; dropped files keep their annotations but aren't listed
 * here until re-opened.
 */
export function AnnotationsReview({
  open,
  onClose,
  entries,
  source,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  entries: LibraryEntry[];
  source: ReaderSource;
  onJump: (target: JumpTarget) => void;
}) {
  const [groups, setGroups] = useState<BookGroup[]>([]);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const samples = useMemo(() => entries.filter((e) => e.kind === 'sample'), [entries]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void Promise.all(
      samples.map(async (entry) => ({
        entry,
        highlights: (await source.loadHighlights?.(entry.id)) ?? [],
        bookmarks: (await source.loadBookmarks?.(entry.id)) ?? [],
      })),
    ).then((all) => {
      if (!live) return;
      setGroups(all.filter((g) => g.highlights.length > 0 || g.bookmarks.length > 0));
    });
    return () => {
      live = false;
    };
  }, [open, samples, source]);

  if (!open) return null;

  const needle = filter.trim().toLowerCase();
  const match = (s: string | undefined) => !needle || (s ?? '').toLowerCase().includes(needle);

  const total = groups.reduce((n, g) => n + g.highlights.length + g.bookmarks.length, 0);

  return (
    <div className="review" role="dialog" aria-label="My annotations" aria-modal="true">
      <div className="review__panel">
        <header className="review__head">
          <h2 className="review__title">My annotations</h2>
          <input
            type="search"
            className="review__filter"
            placeholder="Filter by text or note…"
            aria-label="Filter annotations"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button type="button" className="review__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="review__body">
          {total === 0 && (
            <p className="review__empty">
              Nothing marked yet. Highlight a passage or drop a bookmark (<kbd>b</kbd>) and it
              shows up here.
            </p>
          )}

          {groups.map((g) => {
            const hs = g.highlights.filter((h) => match(h.text) || match(h.note));
            const bs = g.bookmarks.filter((b) => match(b.label) || match(b.text));
            if (needle && hs.length === 0 && bs.length === 0) return null;
            const isCollapsed = collapsed[g.entry.id] ?? false;
            return (
              <section className="review__group" key={g.entry.id}>
                <button
                  type="button"
                  className="review__group-head"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.entry.id]: !isCollapsed }))
                  }
                >
                  <span className="review__group-title">{g.entry.title}</span>
                  <span className="review__group-count">
                    {g.highlights.length + g.bookmarks.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul className="review__list">
                    {hs.map((h) => (
                      <li key={h.id} className="review__row">
                        <button
                          type="button"
                          className="review__jump"
                          onClick={() =>
                            onJump({
                              bookId: g.entry.id,
                              ...(h.kind === 'text' ? { cfi: h.cfi.start } : {}),
                            })
                          }
                        >
                          <span
                            className="review__swatch"
                            style={{ background: h.color }}
                            aria-hidden
                          />
                          <span className="review__text">
                            <span className="review__quote">{h.text || '(highlight)'}</span>
                            {h.note && <span className="review__note">{h.note}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                    {bs.map((b) => (
                      <li key={b.id} className="review__row">
                        <button
                          type="button"
                          className="review__jump"
                          onClick={() =>
                            onJump({
                              bookId: g.entry.id,
                              ...(b.cfi ? { cfi: b.cfi } : { position: b.position }),
                            })
                          }
                        >
                          <span className="review__bm" aria-hidden>
                            ▸
                          </span>
                          <span className="review__text">
                            <span className="review__quote">{b.label}</span>
                            {b.text && <span className="review__note">{b.text}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
