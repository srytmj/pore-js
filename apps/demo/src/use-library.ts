import { openKvStore } from 'porejs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModeGlyph } from './Landing.js';

export interface LibraryEntry {
  id: string;
  title: string;
  glyph: ModeGlyph;
  /** A bundled sample resumes in-place; a dropped file needs re-picking. */
  kind: 'sample' | 'file';
  lastOpened: number;
  percent: number;
}

const KEY = 'pore:demo:library';
const store = openKvStore();

/** A small "recently opened" shelf for the demo home, persisted in IndexedDB. */
export function useLibrary() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const ref = useRef<LibraryEntry[]>([]);

  useEffect(() => {
    void store.get<LibraryEntry[]>(KEY).then((e) => {
      const list = (e ?? []).sort((a, b) => b.lastOpened - a.lastOpened);
      ref.current = list;
      setEntries(list);
    });
  }, []);

  const commit = useCallback((next: LibraryEntry[]) => {
    const sorted = [...next].sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 24);
    ref.current = sorted;
    setEntries(sorted);
    void store.set(KEY, sorted).catch(() => {});
  }, []);

  /** Called when a book is opened. Creates or bumps its entry. */
  const record = useCallback(
    (e: Pick<LibraryEntry, 'id' | 'title' | 'glyph' | 'kind'>) => {
      const prev = ref.current.find((x) => x.id === e.id);
      commit([
        { ...e, lastOpened: Date.now(), percent: prev?.percent ?? 0 },
        ...ref.current.filter((x) => x.id !== e.id),
      ]);
    },
    [commit],
  );

  /** Update reading progress for a book already in the library. */
  const setProgress = useCallback(
    (id: string, percent: number) => {
      const prev = ref.current.find((x) => x.id === id);
      if (!prev || Math.abs(prev.percent - percent) < 0.005) return;
      commit(ref.current.map((x) => (x.id === id ? { ...x, percent } : x)));
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => commit(ref.current.filter((x) => x.id !== id)),
    [commit],
  );

  return { entries, record, setProgress, remove };
}

/** "3 min ago" / "yesterday" / "2 Mar". */
export function relativeTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.round(s / 86400)} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
