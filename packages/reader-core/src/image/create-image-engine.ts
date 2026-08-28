import type { ImageManifest } from '../source/types.js';
import type { Position } from '../position/types.js';
import type { ImageEngineSettings } from '../settings/types.js';
import type { Keymap } from '../settings/keymap.js';
import { resolveAction } from '../settings/keymap.js';
import { resolveKeymap, resolveSettings } from '../settings/merge.js';
import { clampPagePosition } from '../position/position.js';
import type { Direction, TurnDirection } from '../types.js';
import { createEmitter } from '../internal/emitter.js';
import type { ImageEngine, ImageEngineOptions } from './engine.js';
import type { ImageEngineEvents } from './types.js';
import { buildSpreads, clampSpreadIndex, spreadIndexForPage, type Spread } from './spreads.js';
import { PageLoader } from './page-loader.js';

const CONTINUOUS = new Set(['continuous-vertical', 'continuous-horizontal']);

/** Translate a physical page-turn (screen direction) to a logical one. */
export function physicalToLogical(
  physical: 'page-right' | 'page-left',
  direction: Direction,
): TurnDirection {
  const forwardIsRight = direction !== 'rtl';
  const wantRight = physical === 'page-right';
  return wantRight === forwardIsRight ? 'forward' : 'back';
}

export function createImageEngine(options: ImageEngineOptions): ImageEngine {
  const emitter = createEmitter<ImageEngineEvents>();
  const { container, source, bookId } = options;

  let settings: ImageEngineSettings = resolveSettings(options.settings);
  let keymap: Keymap = resolveKeymap(options.keymap);
  let manifest: ImageManifest | null = null;
  let spreads: Spread[] = [];
  let current = 0; // spread index
  let destroyed = false;

  let loader: PageLoader | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const root = container.ownerDocument.createElement('div');
  root.className = 'pore-image';
  root.tabIndex = 0;
  root.style.cssText = 'position:relative;width:100%;height:100%;outline:none;overflow:hidden;';
  const viewport = container.ownerDocument.createElement('div');
  viewport.className = 'pore-image__viewport';
  viewport.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:var(--pore-page-gap,0px);';
  root.appendChild(viewport);

  // ---- helpers ----------------------------------------------------------------

  const chapterFor = (page: number): { id?: string; label: string } => {
    const ch = manifest?.chapters?.filter((c) => c.startIndex <= page).at(-1);
    return ch ? { id: ch.id, label: ch.label } : { label: manifest?.title ?? '' };
  };

  const positionFor = (spreadIndex: number): Position => {
    const total = manifest?.pageCount ?? 0;
    const leading = spreads[spreadIndex]?.leading ?? 0;
    return { type: 'page', value: leading, total };
  };

  const emitLocation = () => {
    if (!manifest) return;
    const leading = spreads[current]?.leading ?? 0;
    const ch = chapterFor(leading);
    emitter.emit('reader:locationchange', {
      position: positionFor(current),
      page: leading,
      ...(ch.id ? { chapter: ch.id } : {}),
      label: `${ch.label} · ${leading + 1}/${manifest.pageCount}`,
    });
  };

  const retainWindow = () => {
    if (!loader) return;
    const keep = new Set<number>();
    for (let d = -settings.preloadBehind; d <= settings.preloadAhead; d++) {
      const sp = spreads[clampSpreadIndex(spreads, current + d)];
      sp?.pages.forEach((p) => keep.add(p));
    }
    loader.retain(keep);
  };

  const applyFitStyle = (img: HTMLImageElement) => {
    const map: Record<ImageEngineSettings['fit'], string> = {
      width: 'width:100%;height:auto;object-fit:contain;',
      height: 'height:100%;width:auto;object-fit:contain;',
      contain: 'max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;',
      original: 'width:auto;height:auto;max-width:none;max-height:none;object-fit:none;',
      smart: 'max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;',
    };
    img.style.cssText = `display:block;${map[settings.fit]}`;
    if (settings.maxWidth) img.style.maxWidth = `${settings.maxWidth}px`;
    if (settings.maxHeight) img.style.maxHeight = `${settings.maxHeight}px`;
  };

  const applyContainerStyle = () => {
    root.style.setProperty('--pore-page-gap', `${settings.pageGap}px`);
    const bg =
      settings.background === 'white' ? '#fff' : settings.background === 'black' ? '#000' : '';
    root.style.background = bg;
    const filters: string[] = [];
    if (settings.brightness !== 1) filters.push(`brightness(${settings.brightness})`);
    if (settings.greyscale) filters.push('grayscale(1)');
    viewport.style.filter = filters.join(' ');
  };

  const render = () => {
    if (!manifest || destroyed) return;
    const spread = spreads[current];
    if (!spread) return;
    applyContainerStyle();

    viewport.replaceChildren();
    for (const pageIndex of spread.pages) {
      const img = container.ownerDocument.createElement('img');
      img.decoding = 'async';
      img.alt = `page ${pageIndex + 1}`;
      applyFitStyle(img);
      viewport.appendChild(img);
      loader
        ?.get(pageIndex)
        .then((url) => {
          if (!destroyed) img.src = url;
        })
        .catch((error: unknown) => emitter.emit('reader:error', { index: pageIndex, error }));
    }
    retainWindow();
    emitLocation();
  };

  const goToSpread = (index: number) => {
    const clamped = clampSpreadIndex(spreads, index);
    if (clamped === current && viewport.childElementCount > 0) return;
    current = clamped;
    render();
  };

  const rebuildSpreads = (preserveLeadingPage?: number) => {
    if (!manifest) return;
    const leading = preserveLeadingPage ?? spreads[current]?.leading ?? 0;
    spreads = buildSpreads(manifest.pages, {
      layout: CONTINUOUS.has(settings.layout) ? 'paged-single' : settings.layout,
      direction: settings.direction,
      spreadOffset: settings.spreadOffset,
    });
    current = spreadIndexForPage(spreads, leading);
    emitter.emit('reader:layoutchange', { layout: settings.layout, spreads: spreads.length });
  };

  // ---- input ----------------------------------------------------------------

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const action = resolveAction(keymap, ev.key);
    if (!action) return;
    switch (action) {
      case 'page-right':
      case 'page-left':
        ev.preventDefault();
        turn(physicalToLogical(action, settings.direction));
        break;
      case 'first-page':
        ev.preventDefault();
        goToSpread(0);
        break;
      case 'last-page':
        ev.preventDefault();
        goToSpread(spreads.length - 1);
        break;
      case 'cycle-fit': {
        ev.preventDefault();
        const order: ImageEngineSettings['fit'][] = [
          'contain',
          'width',
          'height',
          'original',
          'smart',
        ];
        const next = order[(order.indexOf(settings.fit) + 1) % order.length]!;
        setSettings({ fit: next });
        break;
      }
      case 'toggle-spread-offset':
        ev.preventDefault();
        setSettings({ spreadOffset: settings.spreadOffset === 1 ? 0 : 1 });
        break;
      default:
        break;
    }
  };

  // ---- public API ---------------------------------------------------------------

  function turn(dir: TurnDirection): void {
    if (!manifest) return;
    const delta = dir === 'forward' ? 1 : -1;
    const target = current + delta;
    if (target < 0) {
      emitter.emit('reader:start', {});
      return;
    }
    if (target >= spreads.length) {
      emitter.emit('reader:end', { auto: settings.nextChapterAfterLastPage });
      return;
    }
    goToSpread(target);
  }

  function goto(pageIndex: number): void {
    if (!manifest) return;
    goToSpread(spreadIndexForPage(spreads, Math.round(pageIndex)));
  }

  function setSettings(patch: Partial<ImageEngineSettings>): void {
    const prev = settings;
    settings = resolveSettings({ ...settings, ...patch });
    const structural =
      settings.layout !== prev.layout ||
      settings.direction !== prev.direction ||
      settings.spreadOffset !== prev.spreadOffset;
    if (structural) rebuildSpreads();
    render();
  }

  function setKeymap(patch: Partial<Keymap>): void {
    keymap = { ...keymap, ...patch };
  }

  async function mount(): Promise<void> {
    const m = await source.getManifest(bookId);
    if (m.type !== 'image') {
      throw new Error(`createImageEngine: "${bookId}" is a ${m.type} book, not an image book`);
    }
    manifest = m;
    loader = new PageLoader({
      source,
      bookId,
      loadingMethod: settings.loadingMethod === 'bitmap' ? 'blob' : settings.loadingMethod,
      onState: (index, state) => emitter.emit('reader:loadingstate', { index, state }),
    });

    rebuildSpreads(0);

    let restoredPage = 0;
    try {
      const saved = await source.loadProgress(bookId);
      if (saved) restoredPage = clampPagePosition(saved, m.pageCount);
      emitter.emit('reader:resumed', {
        position: saved ?? null,
        page: restoredPage,
      });
    } catch {
      emitter.emit('reader:resumed', { position: null, page: 0 });
    }

    container.replaceChildren(root);
    current = spreadIndexForPage(spreads, restoredPage);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => render());
      resizeObserver.observe(root);
    }
    root.addEventListener('keydown', onKeyDown);

    emitter.emit('reader:ready', { manifest: m });
    render();
  }

  function destroy(): void {
    destroyed = true;
    root.removeEventListener('keydown', onKeyDown);
    resizeObserver?.disconnect();
    loader?.destroy();
    emitter.clear();
    root.remove();
  }

  return { mount, goto, turn, setSettings, setKeymap, on: emitter.on.bind(emitter), destroy };
}
