import { useState } from 'react';
import type { Bookmark } from '@pore/reader-core';
import { useBookmarks } from './reader.js';

export interface BookmarksPanelProps {
  className?: string;
  /** Shown when there are no bookmarks. */
  emptyLabel?: string;
  /** Called after a row's jump button fires (e.g. to close a popover). */
  onJump?: (bookmark: Bookmark) => void;
}

/**
 * The book's bookmarks as an editable list — jump to one, rename it inline,
 * delete it. Headless like {@link HighlightsPanel}: a plain `<ol>` with
 * `data-pore-bm-*` hooks and no chrome of its own. Renders nothing on a source
 * that can't persist bookmarks.
 */
export function BookmarksPanel({
  className,
  emptyLabel = 'No bookmarks yet — press the bookmark button to add one.',
  onJump,
}: BookmarksPanelProps) {
  const { bookmarks, supported, goTo, remove, rename } = useBookmarks();
  const [editing, setEditing] = useState<string | null>(null);

  if (!supported) return null;

  if (bookmarks.length === 0) {
    return (
      <p {...(className ? { className } : {})} data-pore-bm-empty>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol {...(className ? { className } : {})} data-pore-bm-list>
      {bookmarks.map((bm) => (
        <li key={bm.id} data-pore-bm-item>
          {editing === bm.id ? (
            <input
              data-pore-bm-rename
              aria-label="Rename bookmark"
              defaultValue={bm.label}
              autoFocus
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== bm.label) rename(bm.id, v);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              data-pore-bm-jump
              onClick={() => {
                goTo(bm);
                onJump?.(bm);
              }}
              onDoubleClick={() => setEditing(bm.id)}
            >
              <span data-pore-bm-label>{bm.label}</span>
              <span data-pore-bm-pct>{Math.round(bm.percent * 100)}%</span>
            </button>
          )}
          <button
            type="button"
            data-pore-bm-rename-btn
            aria-label="Rename bookmark"
            onClick={() => setEditing(bm.id)}
          >
            ✎
          </button>
          <button
            type="button"
            data-pore-bm-remove
            aria-label="Remove bookmark"
            onClick={() => remove(bm.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  );
}
