import { useCallback, useEffect, useRef, useState } from 'react';
import type { CachedSource, DownloadStatus } from '@pore/reader-core';
import { useReaderSource } from './provider.js';

/** A source that can cache whole books offline (i.e. a {@link CachedSource}). */
type Downloadable = Pick<CachedSource, 'download' | 'downloadStatus' | 'removeDownload'>;

function isDownloadable(s: unknown): s is Downloadable {
  return (
    !!s &&
    typeof (s as Downloadable).download === 'function' &&
    typeof (s as Downloadable).downloadStatus === 'function'
  );
}

export interface UseDownload {
  /** `null` until the first status read; `undefined` if the source can't cache. */
  status: DownloadStatus | null | undefined;
  downloading: boolean;
  error: Error | null;
  start(): void;
  cancel(): void;
  remove(): void;
}

const IDLE: DownloadStatus = { state: 'none', cached: 0, total: 0, bytes: 0 };

/**
 * Drive offline download of `bookId` through the active source. Only does
 * anything when the source is a `CachedSource` with its media cache enabled.
 */
export function useDownload(bookId: string): UseDownload {
  const source = useReaderSource();
  const supported = isDownloadable(source);
  const [status, setStatus] = useState<DownloadStatus | null | undefined>(
    supported ? null : undefined,
  );
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    void (source as Downloadable).downloadStatus(bookId).then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
      abortRef.current?.abort();
    };
  }, [source, supported, bookId]);

  const start = useCallback(() => {
    if (!supported || downloading) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setDownloading(true);
    setError(null);
    void (source as Downloadable)
      .download(bookId, { signal: ac.signal, onProgress: setStatus })
      .then(() => (source as Downloadable).downloadStatus(bookId).then(setStatus))
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        setDownloading(false);
        abortRef.current = null;
      });
  }, [source, supported, bookId, downloading]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const remove = useCallback(() => {
    if (!supported) return;
    void (source as Downloadable).removeDownload(bookId).then(() => setStatus({ ...IDLE }));
  }, [source, supported, bookId]);

  return { status, downloading, error, start, cancel, remove };
}
