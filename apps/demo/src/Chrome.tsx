import {
  SettingsPanel,
  useChromeVisible,
  useEndPage,
  useFootnote,
  useReader,
  useReaderHistory,
  useReaderKind,
  useDownload,
  useReaderSearch,
  useReaderLocation,
  useReaderProgress,
  useReaderSettings,
  useResumedFromPage,
  useTableOfContents,
  type ImageEngineSettings,
  type TextEngineSettings,
  type TocEntry,
} from '@pore/reader-react';
import { useEffect, useState } from 'react';

function flattenToc(entries: TocEntry[], depth = 0): { label: string; href: string }[] {
  return entries.flatMap((e) => [
    { label: `${'  '.repeat(depth)}${e.label}`, href: e.href },
    ...flattenToc(e.children, depth + 1),
  ]);
}

interface BookOpt {
  id: string;
  label: string;
}

export function Chrome({
  books,
  bookId,
  onBook,
  droppedName,
}: {
  books: BookOpt[];
  bookId: string;
  onBook: (id: string) => void;
  droppedName?: string | null;
}) {
  const loc = useReaderLocation();
  const progress = useReaderProgress();
  const download = useDownload(bookId);
  const search = useReaderSearch();
  const [searchOpen, setSearchOpen] = useState(false);
  const reader = useReader();
  const kind = useReaderKind();
  const [imgSettings, setImgSettings] = useReaderSettings<ImageEngineSettings>();
  const [textSettings] = useReaderSettings<TextEngineSettings>();
  const resumed = useResumedFromPage();
  const toc = useTableOfContents();
  const endPage = useEndPage();
  const chromeVisible = useChromeVisible();
  const [footnote, clearFootnote] = useFootnote();
  const [dismissed, setDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const tocFlat = flattenToc(toc).filter((e) => e.href);

  useReaderHistory({ mode: 'url-and-title' });
  useEffect(() => setDismissed(false), [bookId]);

  const isImage = kind === 'image';
  const isText = kind === 'text';
  const menuPos = isText ? textSettings.menuPosition : 'top';
  const menuReveal = isText ? textSettings.menuReveal : 'hover';
  const side = menuPos === 'left' || menuPos === 'right';

  const pos = loc?.position;
  const total = pos && pos.type !== 'anchor' ? pos.total : 0;
  const pct = loc
    ? loc.percent
      ? loc.percent * 100
      : total > 0
        ? ((loc.page + 1) / total) * 100
        : 0
    : 0;

  const barControls = (
    <>
      <strong>Pore.js</strong>
      <select
        aria-label="Book"
        value={droppedName ? '' : bookId}
        onChange={(e) => onBook(e.target.value)}
      >
        {droppedName && <option value="">{droppedName} (dropped)</option>}
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>

      {tocFlat.length > 0 && (
        <select
          aria-label="Table of contents"
          value=""
          onChange={(e) => e.target.value && reader.goToHref(e.target.value)}
        >
          <option value="">Contents…</option>
          {tocFlat.map((t, i) => (
            <option key={i} value={t.href}>
              {t.label}
            </option>
          ))}
        </select>
      )}

      <button onClick={() => reader.turn('back')} aria-label="Previous page">
        ‹
      </button>
      <button onClick={() => reader.turn('forward')} aria-label="Next page">
        ›
      </button>

      {isImage && (
        <button
          className={imgSettings.autoscroll ? 'active' : ''}
          onClick={() => setImgSettings({ autoscroll: !imgSettings.autoscroll })}
          title="Autoscroll"
        >
          {imgSettings.autoscroll ? '⏸' : '▶'}
        </button>
      )}
      {isText && (
        <button
          className={searchOpen ? 'active' : ''}
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search in book"
        >
          🔍
        </button>
      )}
      <button
        className={panelOpen ? 'active' : ''}
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Reader settings"
      >
        ⚙
      </button>

      {download.status !== undefined && (
        <button
          className={download.status?.state === 'complete' ? 'active' : ''}
          onClick={() =>
            download.downloading
              ? download.cancel()
              : download.status?.state === 'complete'
                ? download.remove()
                : download.start()
          }
          aria-label="Download for offline"
          title={
            download.error
              ? `Download failed: ${download.error.message}`
              : download.downloading
                ? `Downloading ${download.status?.cached ?? 0}/${download.status?.total ?? '?'}`
                : download.status?.state === 'complete'
                  ? 'Saved offline — click to remove'
                  : 'Download for offline'
          }
        >
          {download.downloading
            ? `⬇ ${download.status?.cached ?? 0}/${download.status?.total ?? '?'}`
            : download.status?.state === 'complete'
              ? '✓ offline'
              : '⬇'}
        </button>
      )}

      <span className="loc" role="status" aria-live="polite">
        {loc?.label ?? '…'}
        {progress && progress.chapterCount > 1 && (
          <span className="loc__sub">
            {' · '}Ch {progress.chapterIndex + 1}/{progress.chapterCount}
            {progress.minutesLeft > 0 && ` · ${progress.minutesLeft} min left`}
          </span>
        )}
      </span>
    </>
  );

  return (
    <>
      <header
        className={`bar bar--${menuPos}${side ? ` bar--${menuReveal}` : ''}${
          side && chromeVisible ? ' bar--shown' : ''
        }`}
      >
        {barControls}
      </header>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        style={{
          width: `${pct}%`,
          opacity: isImage && imgSettings.progressBar?.style === 'hidden' ? 0 : 1,
        }}
      />

      {panelOpen && (
        <div className="panel-wrap">
          <SettingsPanel onClose={() => setPanelOpen(false)} />
        </div>
      )}

      {searchOpen && isText && (
        <div className="search" role="search">
          <div className="search__row">
            <input
              autoFocus
              type="search"
              placeholder="Search in book…"
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.shiftKey ? search.prev() : search.next())}
            />
            <span className="search__count">
              {search.busy
                ? '…'
                : search.hits.length
                  ? `${search.activeIndex + 1 || '–'}/${search.hits.length}`
                  : search.query.trim().length >= 2
                    ? '0'
                    : ''}
            </span>
            <button onClick={() => setSearchOpen(false)} aria-label="Close search">
              ×
            </button>
          </div>
          <ol className="search__hits">
            {search.hits.slice(0, 50).map((hit, i) => (
              <li key={`${hit.sectionId}-${hit.start}`}>
                <button
                  className={i === search.activeIndex ? 'active' : ''}
                  onClick={() => search.go(i)}
                >
                  <span className="search__pre">{hit.snippet.slice(0, hit.snippetRange[0])}</span>
                  <mark>{hit.snippet.slice(hit.snippetRange[0], hit.snippetRange[1])}</mark>
                  <span>{hit.snippet.slice(hit.snippetRange[1])}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {endPage && (
        <div className="endpage">
          <div className="endpage__title">{endPage.label}</div>
          <div className="endpage__menu">{barControls}</div>
          {endPage.kind === 'book' ? (
            <button onClick={() => reader.goto(0)}>Restart from the beginning</button>
          ) : (
            endPage.hasNext && <button onClick={() => reader.turn('forward')}>Continue →</button>
          )}
        </div>
      )}

      {footnote && (
        <div className="footnote" role="dialog" aria-label="Footnote">
          <button className="footnote__close" onClick={clearFootnote} aria-label="Close">
            ×
          </button>
          <div dangerouslySetInnerHTML={{ __html: footnote.html }} />
        </div>
      )}

      {resumed !== null && !dismissed && (
        <div className="toast">
          Resumed from p.{resumed + 1}
          <button
            onClick={() => {
              reader.goto(0);
              setDismissed(true);
            }}
          >
            Restart
          </button>
          <button onClick={() => setDismissed(true)}>×</button>
        </div>
      )}
    </>
  );
}
