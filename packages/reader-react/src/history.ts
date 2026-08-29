import { useEffect, useRef } from 'react';
import type { ImageEngineSettings } from '@pore/reader-core';
import { useReader, useReaderLocation } from './reader.js';

export type HistoryMode = ImageEngineSettings['historyMode'];

export interface UseReaderHistoryOptions {
  mode?: HistoryMode;
  /** Title template; `{label}` is replaced with the reader's location label. */
  title?: string;
  /** URL search param that holds the page (mode "url-and-title"). Default "p". */
  param?: string;
}

/**
 * Reflects reading position into `document.title` and (optionally) the URL.
 * `url-and-title` pushes a history entry per page so the browser back/forward
 * buttons navigate pages. Use inside `<Reader>`.
 */
export function useReaderHistory({
  mode = 'title',
  title = 'Pore.js — {label}',
  param = 'p',
}: UseReaderHistoryOptions = {}): void {
  const loc = useReaderLocation();
  const reader = useReader();
  const lastPushed = useRef<number | null>(null);

  useEffect(() => {
    if (!loc || mode === 'none') return;
    document.title = title.replace('{label}', loc.label);
    if (mode !== 'url-and-title') return;

    const url = new URL(window.location.href);
    if (url.searchParams.get(param) === String(loc.page)) return;
    url.searchParams.set(param, String(loc.page));
    if (lastPushed.current === null) {
      window.history.replaceState({ porePage: loc.page }, '', url);
    } else {
      window.history.pushState({ porePage: loc.page }, '', url);
    }
    lastPushed.current = loc.page;
  }, [loc, mode, title, param]);

  useEffect(() => {
    if (mode !== 'url-and-title') return;
    const onPop = () => {
      const raw = new URLSearchParams(window.location.search).get(param);
      const page = raw === null ? 0 : Number(raw);
      if (!Number.isNaN(page)) {
        lastPushed.current = page;
        reader.goto(page);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mode, param, reader]);
}
