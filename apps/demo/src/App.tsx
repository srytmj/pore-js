import { CachedSource, DemoSource, createImageEngine, type ImageEngine } from '@pore/reader-core';
import { useEffect, useMemo, useRef, useState } from 'react';

const BOOKS = [
  { id: 'demo-manga', label: 'Demo Manga (RTL, double)' },
  { id: 'demo-webtoon', label: 'Demo Webtoon (vertical)' },
];

export function App() {
  const source = useMemo(() => new CachedSource(new DemoSource()), []);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ImageEngine | null>(null);
  const [bookId, setBookId] = useState(BOOKS[0]!.id);
  const [loc, setLoc] = useState<{ page: number; label: string } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const engine = createImageEngine({
      container: host,
      source,
      bookId,
      settings:
        bookId === 'demo-manga'
          ? { layout: 'paged-double', direction: 'rtl' }
          : { layout: 'continuous-vertical' },
    });
    engineRef.current = engine;
    engine.on('reader:locationchange', (p) => setLoc({ page: p.page, label: p.label }));
    engine.mount().catch((err) => {
      if (!disposed) console.error(err);
    });
    return () => {
      disposed = true;
      engine.destroy();
      engineRef.current = null;
    };
  }, [source, bookId]);

  return (
    <main className="shell">
      <header className="bar">
        <strong>Pore.js</strong>
        <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {BOOKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <button onClick={() => engineRef.current?.turn('back')}>‹ Prev</button>
        <button onClick={() => engineRef.current?.turn('forward')}>Next ›</button>
        <span className="loc">{loc?.label ?? '…'}</span>
      </header>
      <div className="stage" ref={hostRef} />
    </main>
  );
}
