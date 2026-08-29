import { useState } from 'react';
import type { TextEngineSettings } from '@pore/reader-core';
import { useReaderSettings } from './reader.js';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="pore-settings__row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextSettingsPanel({ onClose }: { onClose?: () => void }) {
  const [s, set] = useReaderSettings<TextEngineSettings>();
  const [tab, setTab] = useState<'text' | 'theme' | 'nav'>('text');

  return (
    <div className="pore-settings" role="dialog" aria-label="Reader settings">
      <div className="pore-settings__tabs">
        <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
          Text
        </button>
        <button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>
          Theme
        </button>
        <button className={tab === 'nav' ? 'active' : ''} onClick={() => setTab('nav')}>
          Navigation
        </button>
        {onClose && (
          <button className="pore-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="pore-settings__body">
        {tab === 'text' && (
          <>
            <Row label="Font">
              <select
                value={s.fontFamily}
                onChange={(e) =>
                  set({ fontFamily: e.target.value as TextEngineSettings['fontFamily'] })
                }
              >
                <option value="original">Publisher</option>
                <option value="serif">Serif</option>
                <option value="sans">Sans</option>
                <option value="slab">Slab</option>
                <option value="dyslexic">OpenDyslexic</option>
              </select>
            </Row>
            <Row label={`Font size (${s.fontSizePct}%)`}>
              <input
                type="range"
                min={70}
                max={220}
                step={5}
                value={s.fontSizePct}
                onChange={(e) => set({ fontSizePct: Number(e.target.value) })}
              />
            </Row>
            <Row label={`Line height (${s.lineHeight.toFixed(2)})`}>
              <input
                type="range"
                min={1}
                max={2.4}
                step={0.05}
                value={s.lineHeight}
                onChange={(e) => set({ lineHeight: Number(e.target.value) })}
              />
            </Row>
            <Row label="Justify text">
              <input
                type="checkbox"
                checked={s.textAlign === 'justify'}
                onChange={(e) => set({ textAlign: e.target.checked ? 'justify' : 'start' })}
              />
            </Row>
            <Row label={`Margin (${s.marginPct}%)`}>
              <input
                type="range"
                min={0}
                max={16}
                value={s.marginPct}
                onChange={(e) => set({ marginPct: Number(e.target.value) })}
              />
            </Row>
            <Row label="Columns">
              <select
                value={s.columns}
                onChange={(e) => set({ columns: Number(e.target.value) as 1 | 2 })}
              >
                <option value={1}>One</option>
                <option value={2}>Two</option>
              </select>
            </Row>
            <Row label="Publisher styles">
              <input
                type="checkbox"
                checked={s.publisherStyles}
                onChange={(e) => set({ publisherStyles: e.target.checked })}
              />
            </Row>
          </>
        )}

        {tab === 'theme' && (
          <>
            <Row label="Theme">
              <select
                value={s.theme}
                onChange={(e) => set({ theme: e.target.value as TextEngineSettings['theme'] })}
              >
                <option value="light">Light</option>
                <option value="sepia">Sepia</option>
                <option value="dark">Dark</option>
                <option value="oled">OLED black</option>
              </select>
            </Row>
            <Row label="Dim images (dark themes)">
              <input
                type="checkbox"
                checked={s.dimImages}
                onChange={(e) => set({ dimImages: e.target.checked })}
              />
            </Row>
          </>
        )}

        {tab === 'nav' && (
          <>
            <Row label="At chapter end">
              <select
                value={s.endBehavior}
                onChange={(e) =>
                  set({ endBehavior: e.target.value as TextEngineSettings['endBehavior'] })
                }
              >
                <option value="continuous">Continue to next</option>
                <option value="endpage">Show end page</option>
              </select>
            </Row>
            <Row label="Menu position">
              <select
                value={s.menuPosition}
                onChange={(e) =>
                  set({ menuPosition: e.target.value as TextEngineSettings['menuPosition'] })
                }
              >
                <option value="top">Top bar</option>
                <option value="left">Left side</option>
                <option value="right">Right side</option>
              </select>
            </Row>
            <Row label="Reveal side menu">
              <select
                value={s.menuReveal}
                disabled={s.menuPosition === 'top'}
                onChange={(e) =>
                  set({ menuReveal: e.target.value as TextEngineSettings['menuReveal'] })
                }
              >
                <option value="hover">On hover</option>
                <option value="click">Tap centre</option>
                <option value="dblclick">Double-tap centre</option>
              </select>
            </Row>
          </>
        )}
      </div>
    </div>
  );
}
