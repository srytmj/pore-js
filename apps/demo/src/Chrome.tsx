import {
  FootnotePopover,
  SettingsPanel,
  TableOfContents,
  useChromeVisible,
  useEndPage,
  useReader,
  useReaderHistory,
  useReaderKind,
  useDownload,
  ReaderScrubber,
  useReaderLoading,
  useReaderSearch,
  useReaderLocation,
  useReaderProgress,
  useReaderSettings,
  useResumedFromPage,
  type ImageEngineSettings,
  type TextEngineSettings,
} from '@pore/reader-react';
import { useEffect, useState } from 'react';
import { useTheme } from './theme.js';
import { useAutoHide } from './use-auto-hide.js';


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
  const loading = useReaderLoading();
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const reader = useReader();
  const kind = useReaderKind();
  const [imgSettings, setImgSettings] = useReaderSettings<ImageEngineSettings>();
  const [textSettings] = useReaderSettings<TextEngineSettings>();
  const resumed = useResumedFromPage();
  const endPage = useEndPage();
  const chromeVisible = useChromeVisible();
  const [dismissed, setDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useReaderHistory({ mode: 'url-and-title' });
  useEffect(() => setDismissed(false), [bookId]);

  const isImage = kind === 'image';
  const isText = kind === 'text';
  const menuPos = isText ? textSettings.menuPosition : 'top';
  const menuReveal = isText ? textSettings.menuReveal : 'hover';
  const side = menuPos === 'left' || menuPos === 'right';

  const overlayOpen = panelOpen || searchOpen || endPage !== null;
  const [autoHidden, pinChrome] = useAutoHide(2600, menuPos === 'top' && !overlayOpen);
  useEffect(() => {
    if (overlayOpen) pinChrome();
  }, [overlayOpen, pinChrome]);


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

      <TableOfContents />

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
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
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
        }${!side && autoHidden ? ' bar--autohidden' : ''}`}
      >
        {barControls}
      </header>

      {loading && <div className="progress progress--loading" aria-hidden />}

      {!(isImage && imgSettings.progressBar?.style === 'hidden') && (
        <div
          className={`scrubber-dock${!side && autoHidden ? ' scrubber-dock--hidden' : ''}`}
          onPointerEnter={pinChrome}
        >
          <ReaderScrubber />
        </div>
      )}

      <SettingsPanel open={panelOpen} onOpenChange={setPanelOpen} />

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

      <FootnotePopover />

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
