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
import {
  buildSpreads,
  clampSpreadIndex,
  isNaturallyWide,
  spreadIndexForPage,
  type Spread,
} from './spreads.js';
import {
  estimateVerticalLayout,
  pageAtOffset,
  scrollForPage,
  visibleRange,
  type VerticalLayout,
} from './continuous.js';
import { PageLoader } from './page-loader.js';
import { PrefetchScheduler } from './prefetch.js';

const FIT_CYCLE: ImageEngineSettings['fit'][] = ['contain', 'width', 'height', 'original', 'smart'];
const OVERSCAN_PX = 1200;

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
  const doc = container.ownerDocument;

  let settings = resolveSettings(options.settings);
  let keymap: Keymap = resolveKeymap(options.keymap);
  let manifest: ImageManifest | null = null;
  let destroyed = false;
  let loader: PageLoader | null = null;
  let prefetch: PrefetchScheduler | null = null;
  let cappedNotified = false;
  let resizeObserver: ResizeObserver | null = null;

  // paged state
  let spreads: Spread[] = [];
  let currentSpread = 0;
  // continuous state
  let vlayout: VerticalLayout = { heights: [], offsets: [], total: 0 };
  const measured = new Map<number, number>();
  const mountedImgs = new Map<number, HTMLImageElement>();

  const isContinuous = () => settings.layout === 'continuous-vertical';

  const root = doc.createElement('div');
  root.className = 'pore-image';
  root.tabIndex = 0;
  root.style.cssText = 'position:relative;width:100%;height:100%;outline:none;';
  const viewport = doc.createElement('div');
  viewport.className = 'pore-image__viewport';
  root.appendChild(viewport);

  // ---- shared helpers -------------------------------------------------------

  const chapterFor = (page: number): { id?: string; label: string } => {
    const ch = manifest?.chapters?.filter((c) => c.startIndex <= page).at(-1);
    return ch ? { id: ch.id, label: ch.label } : { label: manifest?.title ?? '' };
  };

  const currentPage = (): number =>
    isContinuous() ? pageAtOffset(vlayout, root.scrollTop) : (spreads[currentSpread]?.leading ?? 0);

  const positionFor = (): Position => {
    const total = manifest?.pageCount ?? 0;
    if (isContinuous()) {
      const page = currentPage();
      return {
        type: 'scroll',
        value: vlayout.total > 0 ? root.scrollTop / vlayout.total : 0,
        total,
        page,
      };
    }
    return { type: 'page', value: currentPage(), total };
  };

  const emitLocation = () => {
    if (!manifest) return;
    const page = currentPage();
    const ch = chapterFor(page);
    emitter.emit('reader:locationchange', {
      position: positionFor(),
      page,
      ...(ch.id ? { chapter: ch.id } : {}),
      label: `${ch.label} · ${page + 1}/${manifest.pageCount}`,
    });
  };

  const applyContainerStyle = () => {
    root.style.setProperty('--pore-page-gap', `${settings.pageGap}px`);
    root.style.overflowY = isContinuous() ? 'auto' : 'hidden';
    root.style.overflowX = 'hidden';
    root.style.background =
      settings.background === 'white' ? '#fff' : settings.background === 'black' ? '#000' : '';
    const filters: string[] = [];
    if (settings.brightness !== 1) filters.push(`brightness(${settings.brightness})`);
    if (settings.greyscale) filters.push('grayscale(1)');
    viewport.style.filter = filters.join(' ');
  };

  const applyFitStyle = (img: HTMLImageElement) => {
    const map: Record<ImageEngineSettings['fit'], string> = {
      width: 'width:100%;height:auto;',
      height: 'height:100%;width:auto;',
      contain: 'max-width:100%;max-height:100%;width:auto;height:auto;',
      original: 'width:auto;height:auto;max-width:none;',
      smart: 'max-width:100%;max-height:100%;width:auto;height:auto;',
    };
    img.style.cssText = `display:block;${map[settings.fit]}`;
    if (settings.maxWidth) img.style.maxWidth = `${settings.maxWidth}px`;
    if (settings.maxHeight) img.style.maxHeight = `${settings.maxHeight}px`;
  };

  const loadInto = (img: HTMLImageElement, pageIndex: number) => {
    loader
      ?.get(pageIndex)
      .then((url) => {
        if (!destroyed) img.src = url;
      })
      .catch((error: unknown) => emitter.emit('reader:error', { index: pageIndex, error }));
  };

  const syncPrefetchAndRetain = () => {
    if (!loader) return;
    const keep = new Set<number>();
    const page = currentPage();
    for (
      let d = -Math.max(settings.preloadBehind, 1);
      d <= Math.max(settings.preloadAhead, 1);
      d++
    ) {
      const i = page + d;
      if (i >= 0 && i < (manifest?.pageCount ?? 0)) keep.add(i);
    }
    if (isContinuous()) {
      const { first, last } = visibleRange(vlayout, root.scrollTop, root.clientHeight, OVERSCAN_PX);
      for (let i = first; i <= last; i++) keep.add(i);
    }
    loader.retain(keep);
    prefetch?.update(page);
  };

  // ---- paged rendering ----------------------------------------------------------

  const renderPaged = () => {
    const spread = spreads[currentSpread];
    if (!spread) return;
    viewport.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:var(--pore-page-gap,0px);';
    viewport.replaceChildren();
    for (const pageIndex of spread.pages) {
      const img = doc.createElement('img');
      img.decoding = 'async';
      img.alt = `page ${pageIndex + 1}`;
      applyFitStyle(img);
      img.addEventListener('load', () => maybeDiscoverWide(pageIndex, img), { once: true });
      viewport.appendChild(img);
      loadInto(img, pageIndex);
    }
  };

  const maybeDiscoverWide = (pageIndex: number, img: HTMLImageElement) => {
    if (destroyed || !manifest || settings.layout !== 'paged-double') return;
    const page = manifest.pages[pageIndex];
    if (!page || page.isWide !== undefined) return;
    if (!isNaturallyWide(page, img.naturalWidth, img.naturalHeight)) return;
    page.isWide = true;
    rebuildSpreads(currentPage());
    render();
  };

  // ---- continuous rendering ---------------------------------------------------

  const recomputeVLayout = () => {
    if (!manifest) return;
    const width = root.clientWidth || 800;
    const fallback = root.clientHeight || 1000;
    vlayout = estimateVerticalLayout(manifest.pages, width, fallback, settings.pageGap, measured);
    viewport.style.height = `${vlayout.total}px`;
  };

  const renderContinuous = () => {
    if (!manifest) return;
    viewport.style.cssText = `position:relative;width:100%;height:${vlayout.total}px;`;
    const { first, last } = visibleRange(vlayout, root.scrollTop, root.clientHeight, OVERSCAN_PX);

    for (const [i, img] of mountedImgs) {
      if (i < first || i > last) {
        img.remove();
        mountedImgs.delete(i);
      }
    }
    for (let i = first; i <= last; i++) {
      let img = mountedImgs.get(i);
      if (!img) {
        img = doc.createElement('img');
        img.decoding = 'async';
        img.alt = `page ${i + 1}`;
        img.style.cssText = 'position:absolute;left:0;width:100%;height:auto;';
        img.addEventListener('load', () => measurePage(i, img!), { once: true });
        viewport.appendChild(img);
        mountedImgs.set(i, img);
        loadInto(img, i);
      }
      img.style.top = `${vlayout.offsets[i]}px`;
    }
  };

  const measurePage = (i: number, img: HTMLImageElement) => {
    if (destroyed || !img.naturalWidth) return;
    const width = root.clientWidth || 800;
    const h = (img.naturalHeight / img.naturalWidth) * width;
    if (Math.abs((measured.get(i) ?? 0) - h) < 1) return;
    const before = vlayout.offsets[i] ?? 0;
    measured.set(i, h);
    recomputeVLayout();
    // compensate scroll if the change was above the fold
    if ((vlayout.offsets[i] ?? 0) !== before && before < root.scrollTop) {
      root.scrollTop += (vlayout.offsets[i] ?? 0) - before;
    }
    renderContinuous();
  };

  // ---- unified render / navigation --------------------------------------------

  const render = () => {
    if (!manifest || destroyed) return;
    applyContainerStyle();
    if (isContinuous()) {
      recomputeVLayout();
      renderContinuous();
    } else {
      renderPaged();
    }
    syncPrefetchAndRetain();
    emitLocation();
  };

  const onScroll = () => {
    if (destroyed || !isContinuous()) return;
    renderContinuous();
    syncPrefetchAndRetain();
    emitLocation();
  };

  const goToSpread = (index: number) => {
    const clamped = clampSpreadIndex(spreads, index);
    currentSpread = clamped;
    render();
  };

  const rebuildSpreads = (preserveLeadingPage?: number) => {
    if (!manifest) return;
    const leading = preserveLeadingPage ?? currentPage();
    spreads = buildSpreads(manifest.pages, {
      layout: isContinuous() ? 'paged-single' : settings.layout,
      direction: settings.direction,
      spreadOffset: settings.spreadOffset,
    });
    currentSpread = spreadIndexForPage(spreads, leading);
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
      case 'scroll-up':
      case 'scroll-down':
        if (isContinuous()) {
          ev.preventDefault();
          root.scrollTop += (action === 'scroll-down' ? 1 : -1) * root.clientHeight * 0.9;
        }
        break;
      case 'first-page':
        ev.preventDefault();
        goto(0);
        break;
      case 'last-page':
        ev.preventDefault();
        goto((manifest?.pageCount ?? 1) - 1);
        break;
      case 'cycle-fit': {
        ev.preventDefault();
        setSettings({ fit: FIT_CYCLE[(FIT_CYCLE.indexOf(settings.fit) + 1) % FIT_CYCLE.length]! });
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
    if (isContinuous()) {
      const atTop = root.scrollTop <= 0;
      const atBottom = root.scrollTop + root.clientHeight >= vlayout.total - 1;
      if (dir === 'back' && atTop) return emitter.emit('reader:start', {});
      if (dir === 'forward' && atBottom) {
        return emitter.emit('reader:end', { auto: settings.nextChapterAfterLastPage });
      }
      root.scrollTop += (dir === 'forward' ? 1 : -1) * root.clientHeight * 0.9;
      return;
    }
    const target = currentSpread + (dir === 'forward' ? 1 : -1);
    if (target < 0) return emitter.emit('reader:start', {});
    if (target >= spreads.length) {
      return emitter.emit('reader:end', { auto: settings.nextChapterAfterLastPage });
    }
    goToSpread(target);
  }

  function goto(pageIndex: number): void {
    if (!manifest) return;
    const p = Math.round(pageIndex);
    if (isContinuous()) {
      root.scrollTop = scrollForPage(vlayout, p);
      onScroll();
    } else {
      goToSpread(spreadIndexForPage(spreads, p));
    }
  }

  function setSettings(patch: Partial<ImageEngineSettings>): void {
    const prev = settings;
    const page = currentPage();
    settings = resolveSettings({ ...settings, ...patch });
    const structural =
      settings.layout !== prev.layout ||
      settings.direction !== prev.direction ||
      settings.spreadOffset !== prev.spreadOffset;
    if (structural) {
      measured.clear();
      mountedImgs.clear();
      viewport.replaceChildren();
      rebuildSpreads(page);
    }
    prefetch?.setSettings(settings);
    render();
    if (structural && isContinuous()) goto(page);
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
    if (settings.loadingMethod === 'bitmap') {
      console.warn('[pore] loadingMethod "bitmap" not implemented yet — using "blob"');
    }
    loader = new PageLoader({
      source,
      bookId,
      loadingMethod: settings.loadingMethod === 'bitmap' ? 'blob' : settings.loadingMethod,
      onState: (index, state) => emitter.emit('reader:loadingstate', { index, state }),
    });
    prefetch = new PrefetchScheduler({
      loader,
      pages: m.pages,
      ...(m.chapters ? { chapters: m.chapters } : {}),
      settings,
      onCapped: () => {
        if (cappedNotified) return;
        cappedNotified = true;
        emitter.emit('reader:error', { error: 'preload-all-capped' });
      },
    });

    rebuildSpreads(0);

    let restoredPage = 0;
    try {
      const saved = await source.loadProgress(bookId);
      if (saved) restoredPage = clampPagePosition(saved, m.pageCount);
      emitter.emit('reader:resumed', { position: saved ?? null, page: restoredPage });
    } catch {
      emitter.emit('reader:resumed', { position: null, page: 0 });
    }

    container.replaceChildren(root);
    currentSpread = spreadIndexForPage(spreads, restoredPage);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => render());
      resizeObserver.observe(root);
    }
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('scroll', onScroll, { passive: true });

    emitter.emit('reader:ready', { manifest: m });
    render();
    if (isContinuous() && restoredPage > 0) goto(restoredPage);
  }

  function on<E extends keyof ImageEngineEvents>(
    event: E,
    handler: (payload: ImageEngineEvents[E]) => void,
  ): () => void {
    return emitter.on(event, handler);
  }

  function destroy(): void {
    destroyed = true;
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('scroll', onScroll);
    resizeObserver?.disconnect();
    prefetch?.destroy();
    loader?.destroy();
    mountedImgs.clear();
    emitter.clear();
    root.remove();
  }

  return { mount, goto, turn, setSettings, setKeymap, on, destroy };
}
