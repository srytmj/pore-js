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
  useReaderError,
  useReaderSearch,
  useReaderLocation,
  useReaderProgress,
  useReaderSettings,
  useReaderHighlights,
  useReaderSelection,
  useTts,
  useResumedFromPage,
  type ImageEngineSettings,
  type TextEngineSettings,
  type Position,
  type TtsVoiceLike,
} from '@pore/reader-react';
import { useEffect, useState } from 'react';
import { useTheme } from './theme.js';
import { useAutoHide } from './use-auto-hide.js';


interface BookOpt {
  id: string;
  label: string;
}

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];

export function Chrome({
  books,
  bookId,
  onBook,
  onHome,
  droppedName,
  opdsOpen,
  onToggleOpds,
}: {
  books: BookOpt[];
  bookId: string;
  onBook: (id: string) => void;
  onHome: () => void;
  droppedName?: string | null;
  opdsOpen: boolean;
  onToggleOpds: () => void;
}) {
  const loc = useReaderLocation();
  const progress = useReaderProgress();
  const download = useDownload(bookId);
  const search = useReaderSearch();
  const loading = useReaderLoading();
  const readerError = useReaderError();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const reader = useReader();
  const kind = useReaderKind();
  const [imgSettings, setImgSettings] = useReaderSettings<ImageEngineSettings>();
  const [textSettings, setTextSettings] = useReaderSettings<TextEngineSettings>();
  const resumed = useResumedFromPage();
  const endPage = useEndPage();
  const chromeVisible = useChromeVisible();
  const [dismissed, setDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [posNotice, setPosNotice] = useState<string | null>(null);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const { selection, highlight, removeHighlight } = useReaderSelection();
  const highlights = useReaderHighlights();
  const tts = useTts();
  const [ttsOpen, setTtsOpen] = useState(false);
  const [voices, setVoices] = useState<TtsVoiceLike[]>([]);
  useEffect(() => {
    if (ttsOpen) setVoices(tts.listVoices());
    else tts.stop();
  }, [ttsOpen]);
  const ttsPlaying = tts.state?.playing ?? false;
  const ttsCanResume = !ttsPlaying && !!tts.state?.sentence;

  useReaderHistory({ mode: 'url-and-title' });
  useEffect(() => setDismissed(false), [bookId]);

  // The "Resumed from p.N" toast auto-dismisses after 15s.
  useEffect(() => {
    if (resumed === null) return;
    const t = setTimeout(() => setDismissed(true), 15_000);
    return () => clearTimeout(t);
  }, [resumed]);

  // Only show the skeleton for loads that take a moment — avoids a flash on
  // cache-warm / fast page turns.
  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowSkeleton(true), 220);
    return () => clearTimeout(t);
  }, [loading]);

  const isImage = kind === 'image';
  const isText = kind === 'text';
  // The reader kind for PDF is 'image' (it's the image engine underneath);
  // search is only meaningful when there's a text layer, so key off the id.
  const isPdf = isImage && /\.pdf$|^demo-pdf$/i.test(bookId);
  const canSearch = isText || isPdf;
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
      <button className="home" onClick={onHome} aria-label="Back to start" title="Back to start">
        Pore.js
      </button>
      <select
        aria-label="Book"
        value={droppedName ? '' : bookId}
        onChange={(e) => e.target.value && onBook(e.target.value)}
      >
        {droppedName && <option value="">{droppedName}</option>}
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>

      <button
        className={opdsOpen ? 'active' : ''}
        onClick={onToggleOpds}
        aria-label="Browse OPDS catalog"
        title="Browse an OPDS catalog"
      >
        📚
      </button>

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
      {canSearch && (
        <button
          className={searchOpen ? 'active' : ''}
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search in book"
        >
          🔍
        </button>
      )}
      {isText && (
        <button
          onClick={() => {
            const cfi = reader.getCfi();
            if (!cfi) return;
            void navigator.clipboard?.writeText(cfi).catch(() => {});
            setPosNotice(cfi);
            setTimeout(() => setPosNotice(null), 4000);
          }}
          aria-label="Copy position (CFI)"
          title="Copy a portable position link (epubcfi)"
        >
          🔗
        </button>
      )}
      {isText && (
        <button
          className={highlightsOpen ? 'active' : ''}
          onClick={() => setHighlightsOpen((v) => !v)}
          aria-label="Highlights"
          title="Highlights"
        >
          🖍{highlights.length > 0 ? ` ${highlights.length}` : ''}
        </button>
      )}
      {isText && (
        <button
          className={ttsOpen ? 'active' : ''}
          onClick={() => setTtsOpen((v) => !v)}
          aria-label="Text to speech"
          title="Listen (text-to-speech)"
        >
          🔊
        </button>
      )}
      {isText ? (
        <button
          onClick={() => {
            const t = textSettings.theme;
            const next = t === 'light' ? 'sepia' : t === 'sepia' ? 'dark' : 'light';
            setTextSettings({ theme: next });
            if ((next === 'dark') !== (theme === 'dark')) toggleTheme(); // keep the chrome in step
          }}
          aria-label={`Reading theme: ${textSettings.theme}. Click to cycle (light, sepia, dark).`}
          title="Reading theme — light · sepia · dark"
        >
          {textSettings.theme === 'sepia' ? '☕' : textSettings.theme === 'light' ? '☀' : '☾'}
        </button>
      ) : (
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀' : '☾'}
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

      {searchOpen && canSearch && (
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
        <div className="endpage" role="status">
          <div className="endpage__icon" aria-hidden>
            {endPage.kind === 'book' ? '✓' : '·'}
          </div>
          <div className="endpage__title">{endPage.label}</div>
          {progress && (
            <div className="endpage__subtitle">
              {endPage.kind === 'book'
                ? `${progress.chapterCount} chapter${progress.chapterCount === 1 ? '' : 's'} · finished`
                : `Chapter ${progress.chapterIndex + 1} of ${progress.chapterCount}`}
            </div>
          )}
          <div className="endpage__actions">
            {endPage.kind === 'book' ? (
              <button className="primary" onClick={() => reader.goto(0)}>
                Restart from the beginning
              </button>
            ) : (
              endPage.hasNext && (
                <button className="primary" onClick={() => reader.turn('forward')}>
                  Continue →
                </button>
              )
            )}
          </div>
          <div className="endpage__menu">{barControls}</div>
        </div>
      )}

      <FootnotePopover />

      {isText && selection && selection.text.trim().length > 0 && (
        <div className="selection-toolbar" role="toolbar" aria-label="Highlight selection">
          <span className="selection-toolbar__text">"{selection.text.slice(0, 40)}"</span>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              className="selection-toolbar__swatch"
              style={{ background: color }}
              aria-label={`Highlight in ${color}`}
              onClick={() => highlight({ color })}
            />
          ))}
        </div>
      )}

      {isText && highlightsOpen && (
        <div className="highlights-panel" role="dialog" aria-label="Highlights">
          <div className="highlights-panel__header">
            <strong>Highlights</strong>
            <button onClick={() => setHighlightsOpen(false)} aria-label="Close highlights">
              ×
            </button>
          </div>
          {highlights.length === 0 ? (
            <p className="highlights-panel__empty">Select text in the book to highlight it.</p>
          ) : (
            <ol className="highlights-panel__list">
              {highlights.map((h) => (
                <li key={h.id}>
                  <button
                    className="highlights-panel__jump"
                    style={{ borderLeftColor: h.color }}
                    onClick={() => {
                      const pos: Position = {
                        type: 'anchor',
                        spine: h.range.spine,
                        block: h.range.startBlock,
                        offset: h.range.startOffset,
                        percent: 0,
                      };
                      reader.goto(pos);
                      setHighlightsOpen(false);
                    }}
                  >
                    {h.text.slice(0, 80)}
                  </button>
                  <button
                    className="highlights-panel__remove"
                    aria-label="Remove highlight"
                    onClick={() => removeHighlight(h.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {isText && ttsOpen && (
        <div className="tts-bar" role="group" aria-label="Text to speech controls">
          <button
            onClick={() => {
              if (ttsPlaying) tts.pause();
              else if (ttsCanResume) tts.resume();
              else tts.play();
            }}
            aria-label={ttsPlaying ? 'Pause' : ttsCanResume ? 'Resume' : 'Play'}
          >
            {ttsPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={() => tts.stop()} aria-label="Stop" disabled={!tts.state?.sentence}>
            ⏹
          </button>
          <select
            value={tts.state?.rate ?? 1}
            onChange={(e) => tts.setRate(Number(e.target.value))}
            aria-label="Speech rate"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          {voices.length > 0 && (
            <select
              value={tts.state?.voice?.voiceURI ?? ''}
              onChange={(e) =>
                tts.setVoice(voices.find((v) => v.voiceURI === e.target.value) ?? null)
              }
              aria-label="Voice"
            >
              <option value="">Default voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          {tts.state?.sentence && (
            <span className="tts-bar__sentence">{tts.state.sentence.text}</span>
          )}
        </div>
      )}

      {posNotice && (
        <div className="notice" role="status" onClick={() => setPosNotice(null)}>
          Copied: {posNotice}
        </div>
      )}

      {showSkeleton && !readerError.error && (
        <div className="skeleton" aria-hidden>
          <div className="skeleton__tile" />
        </div>
      )}

      {readerError.error && (
        <div className="error-tile" role="alert">
          <p>Couldn't load this page.</p>
          <div className="error-tile__actions">
            <button onClick={readerError.retry}>Retry</button>
            <button onClick={readerError.dismiss}>Dismiss</button>
          </div>
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
