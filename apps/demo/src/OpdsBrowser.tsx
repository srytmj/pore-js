import { OpdsSource, type OpdsEntry, type OpdsFeed, type ReaderSource } from '@pore/reader-core';
import { useState } from 'react';

const DEFAULT_URL = '/opds/catalog.xml';

export function OpdsBrowser({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (source: ReaderSource, bookId: string) => void;
}) {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [feed, setFeed] = useState<OpdsFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState<string | null>(null);

  if (!open) return null;

  const browse = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      const feed_ = await new OpdsSource(target).listCatalog();
      setFeed(feed_);
      setUrl(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openEntry = async (entry: OpdsEntry) => {
    setAcquiring(entry.id);
    setError(null);
    try {
      const acquired = await new OpdsSource(url).acquire(entry);
      onOpen(acquired, acquired.bookId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAcquiring(null);
    }
  };

  return (
    <div className="opds-browser" role="dialog" aria-label="OPDS catalog">
      <div className="opds-browser__header">
        <strong>OPDS catalog</strong>
        <button onClick={onClose} aria-label="Close catalog">
          ×
        </button>
      </div>
      <div className="opds-browser__row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="OPDS catalog URL"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void browse(url);
          }}
        />
        <button onClick={() => void browse(url)} disabled={busy}>
          {busy ? '…' : 'Browse'}
        </button>
      </div>
      {error && <p className="opds-browser__error">{error}</p>}
      {feed && (
        <>
          {feed.title && <p className="opds-browser__title">{feed.title}</p>}
          <ol className="opds-browser__list">
            {feed.entries.map((entry) => (
              <li key={entry.id}>
                <div className="opds-browser__entry-title">{entry.title}</div>
                {entry.summary && (
                  <div className="opds-browser__entry-summary">{entry.summary}</div>
                )}
                <button onClick={() => void openEntry(entry)} disabled={acquiring === entry.id}>
                  {acquiring === entry.id ? 'Opening…' : 'Open'}
                </button>
              </li>
            ))}
          </ol>
          {feed.next && (
            <button onClick={() => void browse(feed.next!)} disabled={busy}>
              Next page →
            </button>
          )}
        </>
      )}
    </div>
  );
}
