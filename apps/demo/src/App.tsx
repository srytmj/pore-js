import { CachedSource, DemoSource, LocalFileSource, type ReaderSource } from '@pore/reader-core';
import { Reader, ReaderProvider } from '@pore/reader-react';
import { useEffect, useMemo, useState } from 'react';
import { Chrome } from './Chrome.js';

const BOOKS: { id: string; label: string; settings?: Record<string, unknown> }[] = [
  { id: 'demo-manga', label: 'Demo Manga', settings: { layout: 'paged-double', direction: 'rtl' } },
  { id: 'demo-webtoon', label: 'Demo Webtoon', settings: { layout: 'continuous-vertical' } },
  { id: 'demo-book', label: 'Demo Book (EPUB)' },
  { id: 'demo-pdf', label: 'Demo PDF' },
];

interface Dropped {
  source: ReaderSource;
  bookId: string;
}

export function App() {
  const demoSource = useMemo(() => new CachedSource(new DemoSource()), []);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bookId, setBookId] = useState(() => {
    const fromUrl = new URLSearchParams(location.search).get('book');
    return BOOKS.some((b) => b.id === fromUrl) ? fromUrl! : BOOKS[0]!.id;
  });
  const book = BOOKS.find((b) => b.id === bookId)!;

  useEffect(() => {
    if (dropped) return;
    const url = new URL(location.href);
    url.searchParams.set('book', bookId);
    history.replaceState(null, '', url);
  }, [bookId, dropped]);

  const [notice, setNotice] = useState<string | null>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    setNotice(null);
    const local = new LocalFileSource(files);
    setDropped({ source: new CachedSource(local), bookId: local.bookId });
    void local.getManifest(local.bookId).then(() => {
      if (local.fixedLayout) setNotice('Fixed-layout EPUB — reflow view (beta)');
    });
  };

  const source = dropped?.source ?? demoSource;
  const activeBook = dropped?.bookId ?? bookId;

  return (
    <ReaderProvider source={source}>
      <main
        className="shell"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Reader
          key={activeBook}
          bookId={activeBook}
          {...(!dropped && book.settings ? { initialSettings: book.settings } : {})}
        >
          <Chrome
            books={BOOKS}
            bookId={bookId}
            onBook={(id) => {
              setDropped(null);
              setBookId(id);
            }}
            droppedName={dropped?.bookId ?? null}
          />
        </Reader>
        {dragging && <div className="dropzone">Drop a .cbz, .epub, .pdf, or images to read</div>}
        {notice && (
          <div className="notice" role="status" onClick={() => setNotice(null)}>
            {notice}
          </div>
        )}
      </main>
    </ReaderProvider>
  );
}
