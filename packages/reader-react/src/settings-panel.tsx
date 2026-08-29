import { useState } from 'react';
import { DEFAULT_KEYMAP, type ActionId, type ImageEngineSettings } from '@pore/reader-core';
import { useReaderKeymap, useReaderSettings } from './reader.js';

type Tab = 'layout' | 'fit' | 'behavior' | 'keys';

const ACTION_LABELS: Record<ActionId, string> = {
  'toggle-menu': 'Toggle menu',
  'page-right': 'Turn page right',
  'page-left': 'Turn page left',
  'scroll-up': 'Scroll up',
  'scroll-down': 'Scroll down',
  'chapter-forward': 'Next chapter',
  'chapter-back': 'Previous chapter',
  'toggle-fullscreen': 'Fullscreen',
  'cycle-fit': 'Cycle fit mode',
  'toggle-spread-offset': 'Offset double spreads',
  'first-page': 'First page',
  'last-page': 'Last page',
  'toggle-autoscroll': 'Toggle autoscroll',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="pore-settings__row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [s, set] = useReaderSettings();
  const [keymap, setKeymap] = useReaderKeymap();
  const [tab, setTab] = useState<Tab>('layout');
  const [capturing, setCapturing] = useState<ActionId | null>(null);

  const num =
    <K extends keyof ImageEngineSettings>(k: K) =>
    (e: { target: { value: string } }) =>
      set({ [k]: Number(e.target.value) } as Partial<ImageEngineSettings>);

  return (
    <div className="pore-settings" role="dialog" aria-label="Reader settings">
      <div className="pore-settings__tabs">
        {(['layout', 'fit', 'behavior', 'keys'] as Tab[]).map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'fit'
              ? 'Image fit'
              : t === 'keys'
                ? 'Keybinds'
                : t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
        {onClose && (
          <button className="pore-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="pore-settings__body">
        {tab === 'layout' && (
          <>
            <Row label="Layout">
              <select value={s.layout} onChange={(e) => set({ layout: e.target.value as never })}>
                <option value="paged-single">Single page</option>
                <option value="paged-double">Double page</option>
                <option value="continuous-vertical">Long strip</option>
                <option value="continuous-horizontal">Wide strip</option>
              </select>
            </Row>
            <Row label="Direction">
              <select
                value={s.direction}
                onChange={(e) => set({ direction: e.target.value as never })}
              >
                <option value="ltr">Left to right</option>
                <option value="rtl">Right to left</option>
                <option value="vertical">Vertical</option>
              </select>
            </Row>
            <Row label="Offset double spreads">
              <input
                type="checkbox"
                checked={!!s.spreadOffset}
                onChange={(e) => set({ spreadOffset: e.target.checked ? 1 : 0 })}
              />
            </Row>
            <Row label={`Page gap (${s.pageGap}px)`}>
              <input type="range" min={0} max={60} value={s.pageGap} onChange={num('pageGap')} />
            </Row>
            <Row label="Background">
              <select
                value={s.background}
                onChange={(e) => set({ background: e.target.value as never })}
              >
                <option value="theme">Theme</option>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </Row>
            <Row label="Progress bar">
              <select
                value={s.progressBar.style}
                onChange={(e) =>
                  set({ progressBar: { ...s.progressBar, style: e.target.value as never } })
                }
              >
                <option value="normal">Normal</option>
                <option value="lightbar">Lightbar</option>
                <option value="hidden">Hidden</option>
              </select>
            </Row>
          </>
        )}

        {tab === 'fit' && (
          <>
            <Row label="Fit mode">
              <select value={s.fit} onChange={(e) => set({ fit: e.target.value as never })}>
                <option value="contain">Contain</option>
                <option value="width">Fit width</option>
                <option value="height">Fit height</option>
                <option value="original">Original size</option>
                <option value="smart">Smart</option>
              </select>
            </Row>
            <Row label="Stretch small pages">
              <input
                type="checkbox"
                checked={s.stretchSmallPages}
                onChange={(e) => set({ stretchSmallPages: e.target.checked })}
              />
            </Row>
            <Row label={`Max width (${s.maxWidth ?? 'none'})`}>
              <input
                type="range"
                min={0}
                max={2400}
                step={100}
                value={s.maxWidth ?? 0}
                onChange={(e) => set({ maxWidth: Number(e.target.value) || null })}
              />
            </Row>
            <Row label={`Brightness (${s.brightness.toFixed(2)})`}>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={s.brightness}
                onChange={num('brightness')}
              />
            </Row>
            <Row label="Greyscale">
              <input
                type="checkbox"
                checked={s.greyscale}
                onChange={(e) => set({ greyscale: e.target.checked })}
              />
            </Row>
            <Row label="Dim">
              <input
                type="checkbox"
                checked={s.dim}
                onChange={(e) => set({ dim: e.target.checked })}
              />
            </Row>
          </>
        )}

        {tab === 'behavior' && (
          <>
            <Row label="Tap edges to turn">
              <select
                value={s.tapToTurn}
                onChange={(e) => set({ tapToTurn: e.target.value as never })}
              >
                <option value="directional">Directional</option>
                <option value="always-forward">Always forward</option>
                <option value="never">Never</option>
              </select>
            </Row>
            <Row label="Wheel in paged mode">
              <select
                value={s.scrollToTurn}
                onChange={(e) => set({ scrollToTurn: e.target.value as never })}
              >
                <option value="off">Off</option>
                <option value="wheel">Turn pages</option>
                <option value="both">Turn pages + keys</option>
              </select>
            </Row>
            <Row label="Double-click fullscreen">
              <input
                type="checkbox"
                checked={s.doubleClickFullscreen}
                onChange={(e) => set({ doubleClickFullscreen: e.target.checked })}
              />
            </Row>
            <Row label={`Autoscroll speed (${s.autoscrollSpeed} px/s)`}>
              <input
                type="range"
                min={10}
                max={200}
                value={s.autoscrollSpeed}
                onChange={num('autoscrollSpeed')}
              />
            </Row>
            <Row label="Smooth autoscroll">
              <input
                type="checkbox"
                checked={s.autoscrollSmooth}
                onChange={(e) => set({ autoscrollSmooth: e.target.checked })}
              />
            </Row>
            <Row label={`Paged auto-advance (${s.pagedAutoAdvanceSeconds || 'off'}s)`}>
              <input
                type="range"
                min={0}
                max={20}
                value={s.pagedAutoAdvanceSeconds}
                onChange={num('pagedAutoAdvanceSeconds')}
              />
            </Row>
            <Row label="Next chapter after last page">
              <select
                value={String(s.nextChapterAfterLastPage)}
                onChange={(e) =>
                  set({
                    nextChapterAfterLastPage:
                      e.target.value === 'off' || e.target.value === 'instant'
                        ? (e.target.value as 'off' | 'instant')
                        : (Number(e.target.value) as 3 | 5 | 10),
                  })
                }
              >
                <option value="off">Off</option>
                <option value="instant">Instant</option>
                <option value="3">3s</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
              </select>
            </Row>
          </>
        )}

        {tab === 'keys' && (
          <>
            {(Object.keys(ACTION_LABELS) as ActionId[]).map((action) => (
              <div className="pore-settings__row" key={action}>
                <span>{ACTION_LABELS[action]}</span>
                <span className="pore-settings__keys">
                  {(keymap[action] ?? []).map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                  <button
                    className={capturing === action ? 'active' : ''}
                    onClick={() => setCapturing(action)}
                    onKeyDown={(e) => {
                      if (capturing !== action) return;
                      e.preventDefault();
                      const keys = Array.from(new Set([...(keymap[action] ?? []), e.key])).slice(
                        0,
                        4,
                      );
                      setKeymap({ [action]: keys });
                      setCapturing(null);
                    }}
                  >
                    {capturing === action ? 'press a key…' : '+'}
                  </button>
                  <button onClick={() => setKeymap({ [action]: DEFAULT_KEYMAP[action] })}>
                    reset
                  </button>
                </span>
              </div>
            ))}
            <div className="pore-settings__row">
              <button onClick={() => setKeymap(DEFAULT_KEYMAP)}>Reset all keybinds</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
