import { CachedSource, DemoSource, LocalFileSource, type ReaderSource } from '@pore/reader-core';
import { Reader, ReaderAnnouncer, ReaderProvider, gsapAdapter } from '@pore/reader-react';
import gsap from 'gsap';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chrome } from './Chrome.js';
import { OpdsBrowser } from './OpdsBrowser.js';
import { Landing, type SampleBook } from './Landing.js';
import { useMenuBar } from './use-menu-bar.js';
import { useFullscreen } from './use-fullscreen.js';
import { readerFontFaceCss } from './reader-fonts.js';

export function useAnimations() {
  const [animate, setAnimate] = useState(() => {
    return localStorage.getItem('pore-animate') !== 'false';
  });
  const toggleAnimate = () => {
    setAnimate((prev) => {
      const next = !prev;
      localStorage.setItem('pore-animate', String(next));
      return next;
    });
  };
  return [animate, toggleAnimate] as const;
}

const defaultTransitions = gsapAdapter(gsap);

const BOOKS: SampleBook[] = [
  {
    id: 'demo-manga',
    label: 'Manga',
    blurb: 'Right-to-left, double-page spreads',
    glyph: 'spread',
    settings: { layout: 'paged-double', direction: 'rtl' },
  },
  {
    id: 'demo-webtoon',
    label: 'Webtoon',
    blurb: 'One long, continuous vertical strip',
    glyph: 'strip',
    settings: { layout: 'continuous-vertical' },
  },
  {
    id: 'demo-book',
    label: 'Novel (EPUB)',
    blurb: 'Reflowable text, adjustable typography',
    glyph: 'text',
  },
  { id: 'demo-vertical', label: '縦書き', blurb: 'Vertical Japanese (tategaki)', glyph: 'vertical' },
  { id: 'demo-rtl', label: 'عربي', blurb: 'Right-to-left prose (Arabic)', glyph: 'rtl' },
  {
    id: 'demo-fixed',
    label: 'Fixed-layout',
    blurb: 'Pre-paginated EPUB, scaled to fit',
    glyph: 'page',
  },
  {
    id: 'demo-pdf',
    label: 'PDF',
    blurb: 'Rendered pages + a searchable text layer',
    glyph: 'pdf',
  },
];

type View =
  | { kind: 'landing' }
  | { kind: 'sample'; bookId: string }
  | { kind: 'file'; source: ReaderSource; bookId: string; name: string };

function initialView(): View {
  const fromUrl = new URLSearchParams(location.search).get('book');
  return fromUrl && BOOKS.some((b) => b.id === fromUrl)
    ? { kind: 'sample', bookId: fromUrl }
    : { kind: 'landing' };
}

export function App() {
  const demoSource = useMemo(() => new CachedSource(new DemoSource()), []);
  const [view, setView] = useState<View>(initialView);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [opdsOpen, setOpdsOpen] = useState(false);
  const menu = useMenuBar();
  const [isFullscreen, toggleFullscreen] = useFullscreen();
  const [animate, toggleAnimate] = useAnimations();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // A docked bar takes real space — inset the reader so it isn't covered.
  const isDocked = menu.behaviour === 'always' && !isFullscreen;
  // one rail: menu + inline settings accordion. Width is constant whether or
  // not settings is open; only the explicit collapse toggle changes it.
  const railWidth = menu.collapsed ? '3.25rem' : '16rem';
  const hostClass = isDocked ? `reader-host reader-host--${menu.placement}` : 'reader-host';
  const shellClass = `shell${isDocked ? ` shell--docked-${menu.placement}` : ''}`;
  const shellStyle = { '--rail-w': railWidth } as CSSProperties;

  useEffect(() => {
    const url = new URL(location.href);
    if (view.kind === 'sample') url.searchParams.set('book', view.bookId);
    else url.searchParams.delete('book');
    history.replaceState(null, '', url);
  }, [view]);

  const openFiles = (files: FileList | File[]) => {
    if (!('length' in files) || files.length === 0) return;
    setNotice(null);
    const local = new LocalFileSource(files);
    setView({ kind: 'file', source: new CachedSource(local), bookId: local.bookId, name: local.bookId });
    void local.getManifest(local.bookId).then(() => {
      if (local.fixedLayout) setNotice('Fixed-layout EPUB — pre-paginated view (beta)');
    });
  };

  const openSample = (id: string) => {
    setNotice(null);
    setView({ kind: 'sample', bookId: id });
  };

  const goHome = () => {
    setNotice(null);
    setOpdsOpen(false);
    document.title = 'Pore.js — demo';
    setView({ kind: 'landing' });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) openFiles(e.dataTransfer.files);
  };

  const sample = view.kind === 'sample' ? BOOKS.find((b) => b.id === view.bookId) : undefined;
  const source = view.kind === 'file' ? view.source : demoSource;
  const activeBook = view.kind === 'file' ? view.bookId : view.kind === 'sample' ? view.bookId : '';

  return (
    <main
      className={shellClass}
      style={shellStyle}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {view.kind === 'landing' ? (
        <Landing books={BOOKS} onFiles={openFiles} onSample={openSample} />
      ) : (
        <ReaderProvider source={source}>
          <Reader
            key={activeBook}
            bookId={activeBook}
            fontFaceCss={readerFontFaceCss}
            {...(animate ? { transitions: defaultTransitions } : {})}
            className={hostClass}
            {...(sample?.settings ? { initialSettings: sample.settings } : {})}
          >
            <ReaderAnnouncer />
            <Chrome
              books={BOOKS.map((b) => ({ id: b.id, label: b.label }))}
              bookId={view.kind === 'sample' ? view.bookId : ''}
              onBook={openSample}
              onHome={goHome}
              droppedName={view.kind === 'file' ? view.name : null}
              opdsOpen={opdsOpen}
              onToggleOpds={() => setOpdsOpen((v) => !v)}
              menu={menu}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              animate={animate}
              onToggleAnimate={toggleAnimate}
              settingsOpen={settingsOpen}
              onToggleSettings={() => setSettingsOpen((v) => !v)}
            />
          </Reader>
          <OpdsBrowser
            open={opdsOpen}
            onClose={() => setOpdsOpen(false)}
            onOpen={(opdsSource, id) => {
              setNotice(null);
              setView({ kind: 'file', source: new CachedSource(opdsSource), bookId: id, name: id });
              setOpdsOpen(false);
            }}
          />
        </ReaderProvider>
      )}

      {dragging && (
        <div className="dropzone">
          <div className="dropzone__card">
            <div className="dropzone__icon" aria-hidden>
              ⇩
            </div>
            <div className="dropzone__title">Drop to open</div>
            <div className="dropzone__hint">.cbz, .epub, .pdf, or loose images</div>
          </div>
        </div>
      )}
      {notice && (
        <div className="notice" role="status" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
    </main>
  );
}
