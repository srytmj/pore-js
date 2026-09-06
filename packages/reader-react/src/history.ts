import { useEffect, useRef } from 'react';
import type { ImageEngineSettings, Locator, Manifest } from 'porejs';
import { useReader, useReaderChapters, useReaderLocation, useReaderManifest } from './reader.js';

export type HistoryMode = ImageEngineSettings['historyMode'];

/** What `formatTitle` gets to build `document.title`. */
export interface ReaderTitleContext {
  /** The book's manifest — `null` until it loads. */
  manifest: Manifest | null;
  /** The current location, or `null` before first paint. */
  location: Locator | null;
  /** Current chapter's label, resolved from the chapter list — `null` if none. */
  chapterLabel: string | null;
  /** 0..1 through the book. */
  percent: number;
}

export interface UseReaderHistoryOptions {
  mode?: HistoryMode;
  /**
   * Build the whole `document.title`. Return `''` to leave it untouched (useful
   * when the host app owns the title). Overrides `title`.
   */
  formatTitle?: (ctx: ReaderTitleContext) => string;
  /**
   * @deprecated Use `formatTitle`. Simple template; `{label}` is replaced with
   * the reader's location label.
   */
  title?: string;
  /** URL search param that holds the page (mode "url-and-title"). Default "p". */
  param?: string;
}

/**
 * Default title: `Work · Vol N · Chapter` — the volume and chapter parts appear
 * only when the manifest / chapter list provide them. A dropped local file's
 * manifest title is already the file name, so it reads e.g. `my-comic · 34%`.
 */
function defaultTitle({ manifest, chapterLabel, percent }: ReaderTitleContext): string {
  if (!manifest) return document.title;
  const parts: string[] = [manifest.title];
  if (manifest.volume !== undefined && manifest.volume !== '') parts.push(`Vol ${manifest.volume}`);
  if (chapterLabel) parts.push(chapterLabel);
  else if (percent > 0) parts.push(`${Math.round(percent * 100)}%`);
  return parts.join(' · ');
}

/**
 * Reflects reading position into `document.title` and (optionally) the URL.
 * `url-and-title` pushes a history entry per page so the browser back/forward
 * buttons navigate pages. Use inside `<Reader>`.
 *
 * An embedding host that owns routing/title should either not call this, use
 * `mode: 'none'`, or pass `formatTitle` returning `''`.
 */
export function useReaderHistory({
  mode = 'title',
  formatTitle,
  title,
  param = 'p',
}: UseReaderHistoryOptions = {}): void {
  const loc = useReaderLocation();
  const manifest = useReaderManifest();
  const chapters = useReaderChapters();
  const reader = useReader();
  const lastPushed = useRef<number | null>(null);

  useEffect(() => {
    if (!loc || mode === 'none') return;

    const chapterLabel =
      loc.chapter != null
        ? (chapters.find((c) => c.id === loc.chapter)?.label ??
          [...chapters].reverse().find((c) => c.startPage <= loc.page)?.label ??
          null)
        : ([...chapters].reverse().find((c) => c.startPage <= loc.page)?.label ?? null);

    const next = formatTitle
      ? formatTitle({ manifest, location: loc, chapterLabel, percent: loc.percent })
      : title !== undefined
        ? title.replace('{label}', loc.label)
        : defaultTitle({ manifest, location: loc, chapterLabel, percent: loc.percent });

    if (next) document.title = next;

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
  }, [loc, manifest, chapters, mode, formatTitle, title, param]);

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
