import { CachedSource, DemoSource, LocalFileSource, type ReaderSource } from '@pore/reader-core';
import { Reader, ReaderAnnouncer, ReaderProvider, gsapAdapter } from '@pore/reader-react';
import gsap from 'gsap';
import { useEffect, useMemo, useState } from 'react';
import { Chrome } from './Chrome.js';
import { OpdsBrowser } from './OpdsBrowser.js';
import { Landing, type SampleBook } from './Landing.js';

const transitions = gsapAdapter(gsap);

const BOOKS: SampleBook[] = [
  {
    id: 'demo-manga',
    label: 'Manga',
    blurb: 'Right-to-left, double-page spreads',
    settings: { layout: 'paged-double', direction: 'rtl' },
  },
  {
    id: 'demo-webtoon',
    label: 'Webtoon',
    blurb: 'One long, continuous vertical strip',
    settings: { layout: 'continuous-vertical' },
  },
  { id: 'demo-book', label: 'Novel (EPUB)', blurb: 'Reflowable text, adjustable typography' },
  { id: 'demo-vertical', label: '縦書き', blurb: 'Vertical Japanese (tategaki)' },
  { id: 'demo-rtl', label: 'عربي', blurb: 'Right-to-left prose (Arabic)' },
  { id: 'demo-fixed', label: 'Fixed-layout', blurb: 'Pre-paginated EPUB, scaled to fit' },
  { id: 'demo-pdf', label: 'PDF', blurb: 'Rendered pages + a searchable text layer' },
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
      className="shell"
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
            transitions={transitions}
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
