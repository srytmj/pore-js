import {
  SettingsPanel,
  useFootnote,
  useReader,
  useReaderHistory,
  useReaderKind,
  useReaderLocation,
  useReaderSettings,
  useResumedFromPage,
  useTableOfContents,
  type ImageEngineSettings,
  type TocEntry,
} from '@pore/reader-react';
import { useEffect, useState } from 'react';

function flattenToc(entries: TocEntry[], depth = 0): { label: string; href: string }[] {
  return entries.flatMap((e) => [
    { label: `${'  '.repeat(depth)}${e.label}`, href: e.href },
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
  const reader = useReader();
  const kind = useReaderKind();
  const [settings, setSettings] = useReaderSettings<ImageEngineSettings>();
  const resumed = useResumedFromPage();
  const toc = useTableOfContents();
  const [footnote, clearFootnote] = useFootnote();
  const [dismissed, setDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const tocFlat = flattenToc(toc).filter((e) => e.href);

  useReaderHistory({ mode: 'url-and-title' });
  useEffect(() => setDismissed(false), [bookId]);

  const isImage = kind === 'image';
  const pos = loc?.position;
  const total = pos && pos.type !== 'anchor' ? pos.total : 0;
  const pct = loc
    ? loc.percent
      ? loc.percent * 100
      : total > 0
        ? ((loc.page + 1) / total) * 100
        : 0
    : 0;

  return (
    <>
      <header className="bar">
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
            className={settings.autoscroll ? 'active' : ''}
            onClick={() => setSettings({ autoscroll: !settings.autoscroll })}
            title="Autoscroll"
          >
            {settings.autoscroll ? '⏸' : '▶'}
          </button>
        )}
        <button
          className={panelOpen ? 'active' : ''}
          onClick={() => setPanelOpen((v) => !v)}
          aria-label="Reader settings"
        >
          ⚙
        </button>

        <span className="loc" role="status" aria-live="polite">
          {loc?.label ?? '…'}
        </span>
      </header>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        style={{
          width: `${pct}%`,
          opacity: isImage && settings.progressBar?.style === 'hidden' ? 0 : 1,
        }}
      />

      {panelOpen && (
        <div className="panel-wrap">
          <SettingsPanel onClose={() => setPanelOpen(false)} />
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
