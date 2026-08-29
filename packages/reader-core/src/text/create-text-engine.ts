import type { ReaderSource } from '../source/types.js';
import type { Position } from '../position/types.js';
import { createEmitter } from '../internal/emitter.js';
import { parseEpub } from './epub/parse.js';
import type { EpubBook } from './epub/types.js';
import { dirOf, resolveHref, stripHash } from './epub/path.js';
import { rewriteResources } from './rewrite.js';
import { generateAnchor, pageForElement, resolveAnchor } from './anchor.js';
import {
  buildBaseStylesheet,
  computeTextLayout,
  FLOW_ID,
  offsetForPage,
  pageCountFor,
  VIEWPORT_ID,
  type TextLayout,
} from './paginate.js';
import {
  DEFAULT_TEXT_SETTINGS,
  type TextEngine,
  type TextEngineEvents,
  type TextEngineSettings,
} from './types.js';

const THEME_COLORS: Record<
  TextEngineSettings['theme'],
  { color: string; background: string; dark: boolean }
> = {
  light: { color: '#111', background: '#fdfdfb', dark: false },
  sepia: { color: '#5b4636', background: '#f4ecd8', dark: false },
  dark: { color: '#cdcdcd', background: '#1a1a1a', dark: true },
  oled: { color: '#c8c8c8', background: '#000', dark: true },
};

const SAVE_DEBOUNCE_MS = 800;

export interface CreateTextEngineOptions {
  container: HTMLElement;
  source: ReaderSource;
  bookId: string;
  settings?: Partial<TextEngineSettings>;
  domParser?: DOMParser;
}

export function createTextEngine(options: CreateTextEngineOptions): TextEngine {
  const emitter = createEmitter<TextEngineEvents>();
  const { container, source, bookId } = options;
  const doc = container.ownerDocument;
  const parser = options.domParser ?? new DOMParser();

  let settings: TextEngineSettings = { ...DEFAULT_TEXT_SETTINGS, ...options.settings };
  let book: EpubBook | null = null;
  let spineIndex = 0;
  let page = 0; // page within the current spine
  let spinePageCount = 1;
  /** page count per spine item, undefined until measured */
  let spinePages: (number | undefined)[] = [];
  let destroyed = false;
  let pendingAnchor: Extract<Position, { type: 'anchor' }> | null = null;
  let objectUrls: string[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const root = doc.createElement('div');
  root.className = 'pore-text';
  root.tabIndex = 0;
  root.style.cssText = 'position:relative;width:100%;height:100%;outline:none;overflow:hidden;';
  const frame = doc.createElement('iframe');
  frame.className = 'pore-text__frame';
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:transparent;';
  root.appendChild(frame);

  // ---- helpers -------------------------------------------------------------

  const layout = (): TextLayout =>
    computeTextLayout({
      viewportWidth: root.clientWidth || 800,
      viewportHeight: root.clientHeight || 1000,
      columns: settings.columns,
      columnGap: settings.columnGap,
      marginPct: settings.marginPct,
      fontSizePct: settings.fontSizePct,
    });

  const totalPages = (): number =>
    spinePages.reduce<number>((sum, n, i) => sum + (n ?? estimateSpinePages(i)), 0);

  const bookPageBefore = (idx: number): number => {
    let sum = 0;
    for (let i = 0; i < idx; i++) sum += spinePages[i] ?? estimateSpinePages(i);
    return sum;
  };

  const estimateSpinePages = (i: number): number => {
    const href = book?.spine[i]?.href;
    const res = href ? book?.resource(href) : null;
    if (!res) return 1;
    // ~1800 rendered chars per page is a rough prose average
    return Math.max(1, Math.round(res.bytes.length / 1800));
  };

  const anchorFor = (): Position => {
    const total = totalPages();
    const bookPercent = total > 0 ? (bookPageBefore(spineIndex) + page) / total : 0;
    const cdoc = frame.contentDocument;
    if (!cdoc) {
      return { type: 'anchor', spine: spineIndex, block: 0, offset: 0, percent: bookPercent };
    }
    return generateAnchor(cdoc, {
      spine: spineIndex,
      page,
      spinePages: spinePageCount,
      bookPercent,
      pageWidth: layout().measure,
    });
  };

  const emitLocation = () => {
    if (!book) return;
    const total = totalPages();
    const bookPage = bookPageBefore(spineIndex) + page;
    emitter.emit('reader:locationchange', {
      position: anchorFor(),
      page: bookPage,
      totalPages: total,
      percent: total > 0 ? bookPage / total : 0,
      label: `${book.metadata.title} · ${Math.round((total > 0 ? bookPage / total : 0) * 100)}%`,
      spine: spineIndex,
    });
    scheduleSave();
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  };
  const flushSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!book || destroyed) return;
    void source.saveProgress(bookId, anchorFor()).catch(() => {});
  };

  const flowEl = (): HTMLElement | null =>
    (frame.contentDocument?.getElementById(FLOW_ID) as HTMLElement | null) ?? null;

  /** Move the spine body's content into a clipped viewport + multicol flow. */
  const wrapContent = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc?.body || cdoc.getElementById(FLOW_ID)) return;
    const viewport = cdoc.createElement('div');
    viewport.id = VIEWPORT_ID;
    const flow = cdoc.createElement('div');
    flow.id = FLOW_ID;
    while (cdoc.body.firstChild) flow.appendChild(cdoc.body.firstChild);
    viewport.appendChild(flow);
    cdoc.body.appendChild(viewport);
  };

  const applyPage = () => {
    const flow = flowEl();
    if (!flow) return;
    flow.style.transform = `translateX(${offsetForPage(page, layout().pageStep)}px)`;
  };

  const measure = () => {
    const flow = flowEl();
    if (!flow) return;
    spinePageCount = pageCountFor(flow.scrollWidth, layout().pageStep);
    spinePages[spineIndex] = spinePageCount;
    page = Math.min(page, spinePageCount - 1);
    applyPage();
  };

  const injectStyle = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc) return;
    let el = cdoc.getElementById('pore-base-style') as HTMLStyleElement | null;
    if (!el) {
      el = cdoc.createElement('style');
      el.id = 'pore-base-style';
      cdoc.head?.appendChild(el);
    }
    const theme = THEME_COLORS[settings.theme];
    el.textContent = buildBaseStylesheet(layout(), {
      fontSizePct: settings.fontSizePct,
      lineHeight: settings.lineHeight,
      textAlign: settings.textAlign,
      fontFamily: settings.fontFamily,
      color: theme.color,
      background: theme.background,
      direction: book?.metadata.direction ?? 'ltr',
      publisherStyles: settings.publisherStyles,
    });
  };

  const resolvePendingAnchor = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc || !pendingAnchor || pendingAnchor.spine !== spineIndex) return;
    const anchor = pendingAnchor;
    pendingAnchor = null;
    const flow = flowEl();
    if (flow) flow.style.transform = 'translateX(0)';
    const { page: resolved } = resolveAnchor(cdoc, anchor, {
      spinePages: spinePageCount,
      pageStep: layout().pageStep,
    });
    page = Math.min(Math.max(resolved, 0), spinePageCount - 1);
  };

  const renderSpine = (idx: number, atLastPage = false): Promise<void> => {
    if (!book) return Promise.resolve();
    const item = book.spine[idx];
    if (!item) return Promise.resolve();
    spineIndex = idx;
    emitter.emit('reader:loadingstate', { spine: idx, state: 'loading' });

    revokeUrls();
    const res = book.resource(item.href);
    const source_ = res ? new TextDecoder().decode(res.bytes) : '<p>(missing chapter)</p>';
    const { html, urls } = rewriteResources(source_, book, item.href, parser);
    objectUrls = urls;

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled || destroyed) return;
        settled = true;
        wrapContent();
        injectStyle();
        measure();
        page = atLastPage ? Math.max(0, spinePageCount - 1) : 0;
        resolvePendingAnchor();
        applyPage();
        emitter.emit('reader:loadingstate', { spine: idx, state: 'loaded' });
        emitLocation();
        resolve();
      };
      frame.addEventListener('load', finish, { once: true });
      // jsdom / edge cases where `load` never fires for srcdoc
      setTimeout(finish, 60);
      frame.srcdoc = html;
    }).then(() => {
      wireLinks();
      wireInput();
    });
  };

  /** Intercept footnote / same-doc links inside the iframe. */
  const wireLinks = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc) return;
    cdoc.addEventListener('click', (ev) => {
      const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      const isNote =
        a.getAttribute('epub:type')?.includes('noteref') ||
        a.getAttribute('type')?.includes('noteref');
      if (href.startsWith('#') || isNote) {
        ev.preventDefault();
        openFootnote(href);
      } else if (!/^[a-z]+:/i.test(href)) {
        ev.preventDefault();
        gotoHref(href, item()?.href ?? '');
      }
    });
  };

  let chromeVisible = true;
  let lastWheel = 0;

  const toggleChrome = () => {
    chromeVisible = !chromeVisible;
    emitter.emit('reader:chrometoggle', { visible: chromeVisible });
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    const fwd =
      ['ArrowRight', 'ArrowDown', 'PageDown', 'd', 'D', 'l', ' '].includes(k) && !ev.shiftKey;
    const back =
      ['ArrowLeft', 'ArrowUp', 'PageUp', 'a', 'A', 'h'].includes(k) || (k === ' ' && ev.shiftKey);
    if (fwd) {
      ev.preventDefault();
      turn('forward');
    } else if (back) {
      ev.preventDefault();
      turn('back');
    } else if (k === 'Home') {
      ev.preventDefault();
      goto(0);
    } else if (k === 'End') {
      ev.preventDefault();
      goto(totalPages() - 1);
    } else if (k === 'm' || k === 'M') {
      ev.preventDefault();
      toggleChrome();
    }
  };

  const onWheel = (ev: WheelEvent) => {
    if (ev.ctrlKey) return;
    const now = Date.now();
    if (Math.abs(ev.deltaY) < 4 || now - lastWheel < 320) return;
    lastWheel = now;
    ev.preventDefault();
    turn(ev.deltaY > 0 ? 'forward' : 'back');
  };

  const onClick = (ev: MouseEvent) => {
    if ((ev.target as Element | null)?.closest?.('a')) return;
    const rect = root.getBoundingClientRect();
    const r = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0.5;
    if (r < 1 / 3) turn(book?.metadata.direction === 'rtl' ? 'forward' : 'back');
    else if (r > 2 / 3) turn(book?.metadata.direction === 'rtl' ? 'back' : 'forward');
    else toggleChrome();
  };

  /** Wire keyboard/wheel/click on the iframe doc (events don't bubble to the parent). */
  const wireInput = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc) return;
    cdoc.addEventListener('keydown', onKey);
    cdoc.addEventListener('wheel', onWheel, { passive: false });
    cdoc.addEventListener('click', onClick);
  };

  const item = () => book?.spine[spineIndex];

  const openFootnote = (href: string) => {
    const cdoc = frame.contentDocument;
    if (!book || !cdoc) return;
    const [pathPart, frag] = href.split('#');
    let targetDoc = cdoc;
    let noteHtml = '';
    if (pathPart) {
      const resolved = resolveHref(dirOf(item()?.href ?? ''), pathPart);
      const res = book.resource(resolved);
      if (res) targetDoc = parser.parseFromString(new TextDecoder().decode(res.bytes), 'text/html');
    }
    const el = frag ? targetDoc.getElementById(frag) : null;
    noteHtml = (el?.innerHTML ?? el?.textContent ?? '').trim();
    if (noteHtml) emitter.emit('reader:footnote', { html: noteHtml, href });
  };

  const gotoHref = (href: string, fromHref: string) => {
    if (!book) return;
    const [pathPart, frag] = href.split('#');
    const resolved = pathPart ? resolveHref(dirOf(fromHref), pathPart) : fromHref;
    const targetPath = stripHash(resolved);
    const idx = book.spine.findIndex((s) => s.href === targetPath);
    if (idx === -1) return;
    const jump = () => {
      const cdoc = frame.contentDocument;
      const el = frag && cdoc ? cdoc.getElementById(frag) : null;
      if (el && cdoc) {
        const flow = flowEl();
        if (flow) flow.style.transform = 'translateX(0)';
        page = Math.min(pageForElement(el, layout().pageStep), Math.max(0, spinePageCount - 1));
      } else {
        page = 0;
      }
      applyPage();
      emitLocation();
    };
    if (idx === spineIndex) jump();
    else void renderSpine(idx).then(jump);
  };

  const revokeUrls = () => {
    for (const u of objectUrls) URL.revokeObjectURL(u);
    objectUrls = [];
  };

  // ---- public API -----------------------------------------------------------

  function turn(dir: 'forward' | 'back'): void {
    if (!book) return;
    const delta = dir === 'forward' ? 1 : -1;
    const next = page + delta;
    if (next >= 0 && next < spinePageCount) {
      page = next;
      applyPage();
      emitLocation();
      return;
    }
    // E3 handles spine-boundary crossing; for now clamp with an edge event
    if (next < 0 && spineIndex === 0) emitter.emit('reader:start', {});
    else if (next >= spinePageCount && spineIndex === book.spine.length - 1) {
      emitter.emit('reader:end', {});
    } else {
      void renderSpine(spineIndex + delta, delta < 0);
    }
  }

  function goto(target: number | Position): void {
    if (!book) return;
    if (typeof target === 'object') {
      if (target.type === 'anchor') {
        const idx = Math.min(target.spine, book.spine.length - 1);
        pendingAnchor = target;
        if (idx === spineIndex) {
          resolvePendingAnchor();
          applyPage();
          emitLocation();
        } else {
          void renderSpine(idx);
        }
      }
      return;
    }
    // absolute book page
    let acc = 0;
    for (let i = 0; i < book.spine.length; i++) {
      const count = spinePages[i] ?? estimateSpinePages(i);
      if (target < acc + count) {
        const localPage = target - acc;
        if (i === spineIndex) {
          page = Math.min(Math.max(localPage, 0), spinePageCount - 1);
          applyPage();
          emitLocation();
        } else {
          void renderSpine(i).then(() => {
            page = Math.min(Math.max(localPage, 0), spinePageCount - 1);
            applyPage();
            emitLocation();
          });
        }
        return;
      }
      acc += count;
    }
  }

  /** Reflow (resize / restyle) keeping the reader at the same fraction of the spine. */
  const reflowKeepingPlace = () => {
    const frac = spinePageCount > 0 ? page / spinePageCount : 0;
    injectStyle();
    measure();
    page = Math.min(
      Math.max(Math.round(frac * spinePageCount), 0),
      Math.max(0, spinePageCount - 1),
    );
    applyPage();
    emitLocation();
  };

  function setSettings(patch: Partial<TextEngineSettings>): void {
    settings = { ...settings, ...patch };
    reflowKeepingPlace();
    emitter.emit('reader:settingschange', { settings });
  }

  async function mount(): Promise<void> {
    const manifest = await source.getManifest(bookId);
    if (manifest.type !== 'epub') {
      throw new Error(`createTextEngine: "${bookId}" is a ${manifest.type} book, not an EPUB`);
    }
    const blob = await source.getFile(bookId);
    book = parseEpub(new Uint8Array(await blob.arrayBuffer()), { domParser: parser });
    if (book.metadata.fixedLayout) {
      emitter.emit('reader:error', {
        error: 'fixed-layout EPUB is not supported in this version',
      });
    }
    spinePages = new Array(book.spine.length).fill(undefined);

    container.replaceChildren(root);
    root.addEventListener('keydown', onKey);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('click', onClick);
    if (typeof ResizeObserver !== 'undefined') {
      let raf = 0;
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(reflowKeepingPlace);
      });
      resizeObserver.observe(root);
    }

    let restore: Position | null = null;
    try {
      restore = await source.loadProgress(bookId);
    } catch {
      restore = null;
    }
    emitter.emit('reader:resumed', { position: restore });
    emitter.emit('reader:toc', { toc: book.toc });

    const startSpine =
      restore?.type === 'anchor' ? Math.min(restore.spine, book.spine.length - 1) : 0;
    if (restore?.type === 'anchor') pendingAnchor = restore;
    await renderSpine(startSpine);
    emitter.emit('reader:ready', { metadata: book.metadata, spineCount: book.spine.length });
  }

  function on<E extends keyof TextEngineEvents>(
    event: E,
    handler: (payload: TextEngineEvents[E]) => void,
  ): () => void {
    return emitter.on(event, handler);
  }

  function destroy(): void {
    flushSave();
    destroyed = true;
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('wheel', onWheel);
    root.removeEventListener('click', onClick);
    resizeObserver?.disconnect();
    revokeUrls();
    emitter.clear();
    root.remove();
  }

  return {
    mount,
    goto,
    goToHref: (href: string) => gotoHref(href, item()?.href ?? ''),
    turn,
    setSettings,
    on,
    destroy,
  };
}
