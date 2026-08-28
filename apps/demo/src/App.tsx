import { CachedSource, DemoSource } from '@pore/reader-core';
import { Reader, ReaderProvider } from '@pore/reader-react';
import { useEffect, useMemo, useState } from 'react';
import { Chrome } from './Chrome.js';

const BOOKS = [
  {
    id: 'demo-manga',
    label: 'Demo Manga',
    settings: { layout: 'paged-double', direction: 'rtl' } as const,
  },
  {
    id: 'demo-webtoon',
    label: 'Demo Webtoon',
    settings: { layout: 'continuous-vertical' } as const,
  },
];

export function App() {
  const source = useMemo(() => new CachedSource(new DemoSource()), []);
  const [bookId, setBookId] = useState(() => {
    const fromUrl = new URLSearchParams(location.search).get('book');
    return BOOKS.some((b) => b.id === fromUrl) ? fromUrl! : BOOKS[0]!.id;
  });
  const book = BOOKS.find((b) => b.id === bookId)!;

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('book', bookId);
    history.replaceState(null, '', url);
  }, [bookId]);

  return (
    <ReaderProvider source={source}>
      <main className="shell">
        <Reader
          key={bookId}
          bookId={bookId}
          initialSettings={book.settings}
          onPositionChange={(l) => {
            document.title = `Pore.js — ${l.label}`;
          }}
        >
          <Chrome books={BOOKS} bookId={bookId} onBook={setBookId} />
        </Reader>
      </main>
    </ReaderProvider>
  );
}
