import {
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

        <select
          aria-label="Layout"
          value={settings.layout}
          onChange={(e) => setSettings({ layout: e.target.value as typeof settings.layout })}
        >
          <option value="paged-single">Single</option>
          <option value="paged-double">Double</option>
          <option value="continuous-vertical">Long strip</option>
          <option value="continuous-horizontal">Wide strip</option>
        </select>

        <select
          aria-label="Reading direction"
          value={settings.direction}
          onChange={(e) => setSettings({ direction: e.target.value as typeof settings.direction })}
        >
          <option value="ltr">LTR</option>
          <option value="rtl">RTL</option>
        </select>

        <select
          aria-label="Fit mode"
          value={settings.fit}
          onChange={(e) => setSettings({ fit: e.target.value as typeof settings.fit })}
        >
          <option value="contain">Fit</option>
          <option value="width">Width</option>
          <option value="height">Height</option>
          <option value="original">1:1</option>
        </select>

        <button
          className={settings.spreadOffset ? 'active' : ''}
          onClick={() => setSettings({ spreadOffset: settings.spreadOffset ? 0 : 1 })}
          title="Offset double spreads"
        >
          Offset
        </button>

        <button
          className={settings.autoscroll ? 'active' : ''}
          onClick={() => setSettings({ autoscroll: !settings.autoscroll })}
          title="Autoscroll"
        >
          {settings.autoscroll ? '⏸' : '▶'}
        </button>

        <label className="slider" title="Brightness">
          ☀
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.brightness}
            onChange={(e) => setSettings({ brightness: Number(e.target.value) })}
          />
        </label>
        <button
          className={settings.greyscale ? 'active' : ''}
          onClick={() => setSettings({ greyscale: !settings.greyscale })}
          title="Greyscale"
        >
          B/W
        </button>
        <button
          className={settings.dim ? 'active' : ''}
          onClick={() => setSettings({ dim: !settings.dim })}
          title="Dim"
        >
          Dim
        </button>

        <button aria-label="Previous page" onClick={() => reader.turn('back')}>
          ‹
        </button>
        <button aria-label="Next page" onClick={() => reader.turn('forward')}>
          ›
        </button>
        <span className="loc" role="status" aria-live="polite">
          {loc?.label ?? '…'}
        </span>
      </header>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        style={{ width: `${pct}%` }}
      />

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
