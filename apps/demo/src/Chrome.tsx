import {
  SettingsPanel,
  useReader,
  useReaderHistory,
  useReaderLocation,
  useReaderSettings,
  useResumedFromPage,
} from '@pore/reader-react';
import { useEffect, useState } from 'react';

interface BookOpt {
  id: string;
  label: string;
}

export function Chrome({
  books,
  bookId,
  onBook,
}: {
  books: BookOpt[];
  bookId: string;
  onBook: (id: string) => void;
}) {
  const loc = useReaderLocation();
  const reader = useReader();
  const [settings, setSettings] = useReaderSettings();
  const resumed = useResumedFromPage();
  const [dismissed, setDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useReaderHistory({ mode: 'url-and-title' });
  useEffect(() => setDismissed(false), [bookId]);

  const pos = loc?.position;
  const total = pos && pos.type !== 'anchor' ? pos.total : 0;
  const pct = total > 0 && loc ? ((loc.page + 1) / total) * 100 : 0;

  return (
    <>
      <header className="bar">
        <strong>Pore.js</strong>
        <select aria-label="Book" value={bookId} onChange={(e) => onBook(e.target.value)}>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>

        <button onClick={() => reader.turn('back')} aria-label="Previous page">
          ‹
        </button>
        <button onClick={() => reader.turn('forward')} aria-label="Next page">
          ›
        </button>

        <button
          className={settings.autoscroll ? 'active' : ''}
          onClick={() => setSettings({ autoscroll: !settings.autoscroll })}
          title="Autoscroll"
        >
          {settings.autoscroll ? '⏸' : '▶'}
        </button>
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
        style={{ width: `${pct}%`, opacity: settings.progressBar.style === 'hidden' ? 0 : 1 }}
      />

      {panelOpen && (
        <div className="panel-wrap">
          <SettingsPanel onClose={() => setPanelOpen(false)} />
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
