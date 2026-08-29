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
  estimateLinearLayout,
  pageAtOffset,
  scrollForPage,
  visibleRange,
  type ContinuousAxis,
  type LinearLayout,
} from './continuous.js';
import { clampZoom, resolveTap, swipeTurn, zoneForPoint } from './input.js';
import { PageLoader } from './page-loader.js';
import { PrefetchScheduler } from './prefetch.js';

const FIT_CYCLE: ImageEngineSettings['fit'][] = ['contain', 'width', 'height', 'original', 'smart'];
const OVERSCAN_PX = 1200;
const TAP_SLOP = 10;
const TAP_MS = 350;
const SAVE_DEBOUNCE_MS = 800;

/** Directions where "forward" advances leftward / upward (reverse of LTR). */
export function isReverseDirection(direction: Direction): boolean {
  return direction === 'rtl' || direction === 'vertical';
}

/** Translate a physical page-turn (screen direction) to a logical one. */
export function physicalToLogical(
  physical: 'page-right' | 'page-left',
  direction: Direction,
): TurnDirection {
  const forwardIsRight = !isReverseDirection(direction);
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
  let clayout: LinearLayout = { sizes: [], offsets: [], total: 0 };
  /** layout slot -> real page index (identity unless RTL horizontal, which reverses) */
  let slotToPage: number[] = [];
  const measured = new Map<number, number>();
  const mountedImgs = new Map<number, HTMLImageElement>();
  // input state
  let chromeVisible = settings.headerVisible;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pointer: { x: number; y: number; t: number; id: number } | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const isContinuous = () =>
    settings.layout === 'continuous-vertical' || settings.layout === 'continuous-horizontal';
  const axis = (): ContinuousAxis => (settings.layout === 'continuous-horizontal' ? 'x' : 'y');
  /** RTL horizontal reads right→left; we reverse the layout so scroll stays positive. */
  const rtlHorizontal = () => axis() === 'x' && settings.direction === 'rtl';
  const scrollMain = (): number => (axis() === 'x' ? root.scrollLeft : root.scrollTop);
  const setScrollMain = (v: number) => {
    if (axis() === 'x') root.scrollLeft = v;
    else root.scrollTop = v;
  };
  const viewportMain = (): number => (axis() === 'x' ? root.clientWidth : root.clientHeight) || 1;
  const slotForPage = (page: number): number => {
    const s = slotToPage.indexOf(page);
    return s === -1 ? 0 : s;
  };

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

  const currentPage = (): number => {
    if (!isContinuous()) return spreads[currentSpread]?.leading ?? 0;
    const slot = pageAtOffset(clayout, scrollMain());
    return slotToPage[slot] ?? 0;
  };

  const positionFor = (): Position => {
    const total = manifest?.pageCount ?? 0;
    if (isContinuous()) {
      const page = currentPage();
      return {
        type: 'scroll',
        value: clayout.total > 0 ? scrollMain() / clayout.total : 0,
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
    scheduleSave();
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  };

  const flushSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!manifest || destroyed) return;
    void source.saveProgress(bookId, positionFor()).catch(() => {});
  };

  const applyContainerStyle = () => {
    root.style.setProperty('--pore-page-gap', `${settings.pageGap}px`);
    root.style.overflowY = isContinuous() && axis() === 'y' ? 'auto' : 'hidden';
    root.style.overflowX = isContinuous() && axis() === 'x' ? 'auto' : 'hidden';
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
      const { first, last } = visibleRange(clayout, scrollMain(), viewportMain(), OVERSCAN_PX);
      for (let s = first; s <= last; s++) {
        const p = slotToPage[s];
        if (p !== undefined) keep.add(p);
      }
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

  // ---- continuous rendering (axis-generic) -----------------------------------

  const recomputeLayout = () => {
    if (!manifest) return;
    const n = manifest.pages.length;
    slotToPage = rtlHorizontal()
      ? Array.from({ length: n }, (_, s) => n - 1 - s)
      : Array.from({ length: n }, (_, s) => s);
    const slotPages = slotToPage.map((p) => manifest!.pages[p]!);
    const slotMeasured = new Map<number, number>();
    slotToPage.forEach((p, s) => {
      const m = measured.get(p);
      if (m !== undefined) slotMeasured.set(s, m);
    });
    const cross = axis() === 'x' ? root.clientHeight || 1000 : root.clientWidth || 800;
    clayout = estimateLinearLayout(slotPages, {
      axis: axis(),
      crossSize: cross,
      fallbackMain: viewportMain(),
      gap: settings.pageGap,
      measured: slotMeasured,
    });
  };

  const renderContinuous = () => {
    if (!manifest) return;
    const horiz = axis() === 'x';
    viewport.style.cssText = horiz
      ? `position:relative;height:100%;width:${clayout.total}px;`
      : `position:relative;width:100%;height:${clayout.total}px;`;
    const { first, last } = visibleRange(clayout, scrollMain(), viewportMain(), OVERSCAN_PX);
    const wanted = new Set<number>();
    for (let s = first; s <= last; s++) wanted.add(slotToPage[s]!);

    for (const [p, img] of mountedImgs) {
      if (!wanted.has(p)) {
        img.remove();
        mountedImgs.delete(p);
      }
    }
    for (let s = first; s <= last; s++) {
      const p = slotToPage[s]!;
      let img = mountedImgs.get(p);
      if (!img) {
        img = doc.createElement('img');
        img.decoding = 'async';
        img.alt = `page ${p + 1}`;
        img.style.cssText = horiz
          ? 'position:absolute;top:0;height:100%;width:auto;'
          : 'position:absolute;left:0;width:100%;height:auto;';
        const el = img;
        img.addEventListener('load', () => measurePage(p, s, el), { once: true });
        viewport.appendChild(img);
        mountedImgs.set(p, img);
        loadInto(img, p);
      }
      img.style[horiz ? 'left' : 'top'] = `${clayout.offsets[s]}px`;
    }
  };

  const measurePage = (page: number, slot: number, img: HTMLImageElement) => {
    if (destroyed || !img.naturalWidth) return;
    const horiz = axis() === 'x';
    const cross = horiz ? root.clientHeight || 1000 : root.clientWidth || 800;
    const size = horiz
      ? (img.naturalWidth / img.naturalHeight) * cross
      : (img.naturalHeight / img.naturalWidth) * cross;
    if (Math.abs((measured.get(page) ?? 0) - size) < 1) return;
    const before = clayout.offsets[slot] ?? 0;
    measured.set(page, size);
    recomputeLayout();
    if ((clayout.offsets[slot] ?? 0) !== before && before < scrollMain()) {
      setScrollMain(scrollMain() + ((clayout.offsets[slot] ?? 0) - before));
    }
    renderContinuous();
  };

  // ---- unified render / navigation --------------------------------------------

  const render = () => {
    if (!manifest || destroyed) return;
    applyContainerStyle();
    if (isContinuous()) {
      recomputeLayout();
      renderContinuous();
    } else {
      renderPaged();
      applyZoom();
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
          setScrollMain(scrollMain() + (action === 'scroll-down' ? 1 : -1) * viewportMain() * 0.9);
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
      case 'toggle-fullscreen':
        ev.preventDefault();
        void toggleFullscreen();
        break;
      case 'toggle-menu':
        ev.preventDefault();
        toggleChrome();
        break;
      default:
        break;
    }
  };

  const applyZoom = () => {
    if (isContinuous()) return;
    viewport.style.transform =
      zoom === 1 && panX === 0 && panY === 0
        ? ''
        : `translate(${panX}px, ${panY}px) scale(${zoom})`;
  };

  const setZoom = (next: number, originX = 0.5, originY = 0.5) => {
    const clamped = clampZoom(next);
    if (clamped === zoom) return;
    zoom = clamped;
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    } else {
      viewport.style.transformOrigin = `${originX * 100}% ${originY * 100}%`;
    }
    applyZoom();
    emitter.emit('reader:zoomchange', { scale: zoom });
  };

  const toggleChrome = () => {
    chromeVisible = !chromeVisible;
    emitter.emit('reader:chrometoggle', { visible: chromeVisible });
  };

  const onPointerDown = (ev: PointerEvent) => {
    pointer = { x: ev.clientX, y: ev.clientY, t: Date.now(), id: ev.pointerId };
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!pointer || ev.pointerId !== pointer.id || zoom === 1) return;
    panX += ev.clientX - pointer.x;
    panY += ev.clientY - pointer.y;
    pointer = { ...pointer, x: ev.clientX, y: ev.clientY };
    applyZoom();
  };

  const onPointerUp = (ev: PointerEvent) => {
    if (!pointer || ev.pointerId !== pointer.id) return;
    const dx = ev.clientX - pointer.x;
    const dy = ev.clientY - pointer.y;
    const dt = Date.now() - pointer.t;
    pointer = null;
    if (zoom > 1) return; // panning, not a tap/swipe

    const dist = Math.hypot(dx, dy);
    if (dist <= TAP_SLOP && dt <= TAP_MS) {
      const rect = root.getBoundingClientRect();
      const zone = zoneForPoint(ev.clientX - rect.left, rect.width);
      const result = resolveTap(zone, settings.tapToTurn, settings.direction);
      if (result === 'toggle-chrome') toggleChrome();
      else if (result) turn(result);
      return;
    }
    // swipe: only horizontal swipes turn pages (vertical = native scroll)
    if (!isContinuous() && Math.abs(dx) > Math.abs(dy)) {
      const t = swipeTurn(dx, settings.direction);
      if (t) turn(t);
    }
  };

  const onWheel = (ev: WheelEvent) => {
    if (ev.ctrlKey) {
      ev.preventDefault();
      const rect = root.getBoundingClientRect();
      setZoom(
        zoom * (ev.deltaY < 0 ? 1.1 : 0.9),
        (ev.clientX - rect.left) / rect.width,
        (ev.clientY - rect.top) / rect.height,
      );
      return;
    }
    if (isContinuous()) return;
    const mode = settings.scrollToTurn;
    if (mode === 'wheel' || mode === 'both') {
      ev.preventDefault();
      turn(ev.deltaY > 0 ? 'forward' : 'back');
    }
  };

  const onDblClick = () => {
    if (settings.doubleClickFullscreen) void toggleFullscreen();
    else setZoom(zoom > 1 ? 1 : 2);
  };

  async function toggleFullscreen(): Promise<void> {
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await root.requestFullscreen?.();
    } catch {
      /* user gesture / permission — ignore */
    }
  }

  async function acquireWakeLock(): Promise<void> {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLock = null;
    }
  }

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') flushSave();
    else if (!wakeLock) void acquireWakeLock();
  };

  // ---- public API ---------------------------------------------------------------

  function turn(dir: TurnDirection): void {
    if (!manifest) return;
    if (isContinuous()) {
      const atStart = scrollMain() <= 0;
      const atEnd = scrollMain() + viewportMain() >= clayout.total - 1;
      if (dir === 'back' && atStart) return emitter.emit('reader:start', {});
      if (dir === 'forward' && atEnd) {
        return emitter.emit('reader:end', { auto: settings.nextChapterAfterLastPage });
      }
      setScrollMain(scrollMain() + (dir === 'forward' ? 1 : -1) * viewportMain() * 0.9);
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
      recomputeLayout();
      setScrollMain(scrollForPage(clayout, slotForPage(p)));
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
      zoom = 1;
      panX = 0;
      panY = 0;
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
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', () => (pointer = null));
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('dblclick', onDblClick);
    doc.addEventListener('visibilitychange', onVisibility);
    void acquireWakeLock();

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
    flushSave();
    destroyed = true;
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('scroll', onScroll);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('wheel', onWheel);
    root.removeEventListener('dblclick', onDblClick);
    doc.removeEventListener('visibilitychange', onVisibility);
    resizeObserver?.disconnect();
    prefetch?.destroy();
    loader?.destroy();
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
    mountedImgs.clear();
    emitter.clear();
    root.remove();
  }

  return { mount, goto, turn, setSettings, setKeymap, on, destroy };
}
