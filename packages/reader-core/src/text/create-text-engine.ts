import type { ReaderSource } from '../source/types.js';
import type { Position } from '../position/types.js';
import { createEmitter } from '../internal/emitter.js';
import type { Chapter } from '../reader-engine.js';
import { PaceEstimator, chapterProgress } from '../progress.js';
import { parseEpub } from './epub/parse.js';
import type { EpubBook, TocEntry } from './epub/types.js';
import { dirOf, resolveHref, stripHash } from './epub/path.js';
import { rewriteResources } from './rewrite.js';
import { blockElements, generateAnchor, pageForElement, resolveAnchor } from './anchor.js';
import { SearchController } from '../search/search-controller.js';
import type { SearchHit, SearchSection } from '../search/search-index.js';
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
  /** Passed to the in-book `SearchController`. `false` forces synchronous search. */
  searchWorkerFactory?: (() => Worker) | false;
}

export function createTextEngine(options: CreateTextEngineOptions): TextEngine {
  const emitter = createEmitter<TextEngineEvents>();
  const { container, source, bookId } = options;
  const doc = container.ownerDocument;
  const parser = options.domParser ?? new DOMParser();

  let settings: TextEngineSettings = { ...DEFAULT_TEXT_SETTINGS, ...options.settings };
  let book: EpubBook | null = null;
  const pace = new PaceEstimator(30);
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
  const endEl = doc.createElement('div');
  endEl.className = 'pore-text__end';
  endEl.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;gap:1rem;align-items:center;justify-content:center;text-align:center;padding:2rem;z-index:2;';
  root.appendChild(endEl);

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

  const lastSpine = () => (book ? book.spine.length - 1 : 0);
  const contentPages = (i: number): number => spinePages[i] ?? estimateSpinePages(i);
  /** The last chapter always ends on a "The End" card; others only in `endpage` mode. */
  const hasEndSlot = (i: number): boolean =>
    settings.endBehavior === 'endpage' || i === lastSpine();
  const effectivePages = (i: number): number => contentPages(i) + (hasEndSlot(i) ? 1 : 0);
  /** Highest valid `page` for the current spine (the end-slot index, if any). */
  const maxPage = (): number => spinePageCount - 1 + (hasEndSlot(spineIndex) ? 1 : 0);
  const onEndSlot = (): boolean => hasEndSlot(spineIndex) && page >= spinePageCount;

  const totalPages = (): number => {
    let sum = 0;
    for (let i = 0; i <= lastSpine(); i++) sum += effectivePages(i);
    return sum;
  };

  const bookPageBefore = (idx: number): number => {
    let sum = 0;
    for (let i = 0; i < idx; i++) sum += effectivePages(i);
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
    const atBookEnd = onEndSlot() && spineIndex === lastSpine();
    const percent = atBookEnd ? 1 : total > 0 ? bookPage / total : 0;
    const ch = chapterLabel(spineIndex);
    const loc = {
      position: anchorFor(),
      page: bookPage,
      total,
      percent,
      label: `${ch} · ${Math.round(percent * 100)}%`,
      chapter: book.spine[spineIndex]?.idref ?? String(spineIndex),
    };
    emitter.emit('reader:locationchange', loc);
    pace.mark();
    const chs = engineChapters();
    const cp = chapterProgress(chs, bookPage, total);
    emitter.emit('reader:progress', {
      locator: loc,
      percent,
      chapterLabel: cp.label || ch,
      chapterIndex: cp.index,
      chapterCount: chs.length,
      pagesLeftInChapter: cp.pagesLeftInChapter,
      minutesLeft: pace.minutesLeft(Math.max(0, total - 1 - bookPage)),
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

  const chapterLabel = (i: number): string => {
    if (!book) return `Chapter ${i + 1}`;
    const href = book.spine[i]?.href;
    const flat = (entries: TocEntry[]): TocEntry[] =>
      entries.flatMap((e) => [e, ...flat(e.children)]);
    const hit = flat(book.toc).find((e) => stripHash(e.href) === href);
    return hit?.label ?? `Chapter ${i + 1}`;
  };

  // ---- in-book search -----------------------------------------------------

  const search = new SearchController(
    options.searchWorkerFactory !== undefined
      ? { workerFactory: options.searchWorkerFactory }
      : {},
  );
  let searchBuilt: Promise<void> | null = null;

  const sectionId = (i: number): string => book?.spine[i]?.idref ?? String(i);

  const searchSections = (): SearchSection[] => {
    const b = book;
    if (!b) return [];
    return b.spine.map((item, index) => {
      const res = b.resource(item.href);
      const doc = parser.parseFromString(
        res ? new TextDecoder().decode(res.bytes) : '',
        'text/html',
      );
      doc.querySelectorAll('script, style').forEach((el) => el.remove());
      return { id: sectionId(index), index, text: doc.body?.textContent ?? '' };
    });
  };

  const runSearch = async (query: string): Promise<SearchHit[]> => {
    if (!book) return [];
    searchBuilt ??= search.build(searchSections());
    await searchBuilt;
    const hits = await search.query(query, { limit: 300 });
    emitter.emit('reader:searchresults', { query, hits });
    return hits;
  };

  /** Block element whose accumulated collapsed text spans `offset`. */
  const blockForOffset = (doc: Document, offset: number): Element | null => {
    const blocks = blockElements(doc);
    let seen = 0;
    for (const el of blocks) {
      const len = (el.textContent ?? '').replace(/\s+/g, ' ').trim().length + 1;
      if (seen + len > offset) return el;
      seen += len;
    }
    return blocks.at(-1) ?? null;
  };

  const gotoHit = (hit: SearchHit): void => {
    if (!book) return;
    const idx = book.spine.findIndex((_, i) => sectionId(i) === hit.sectionId);
    if (idx < 0) return;
    const land = () => {
      const cdoc = frame.contentDocument;
      if (!cdoc) return;
      const flow = flowEl();
      if (flow) flow.style.transform = 'translateX(0)';
      const el = blockForOffset(cdoc, hit.start);
      if (el) {
        page = Math.min(pageForElement(el, layout().pageStep), Math.max(0, spinePageCount - 1));
      }
      renderView();
      emitLocation();
    };
    if (idx === spineIndex) land();
    else void renderSpine(idx).then(land);
  };

  const engineChapters = (): Chapter[] => {
    if (!book) return [];
    const total = totalPages();
    return book.spine.map((s, i) => {
      const startPage = bookPageBefore(i);
      return {
        id: s.idref ?? String(i),
        label: chapterLabel(i),
        startPage,
        startPercent: total > 0 ? startPage / total : 0,
      };
    });
  };

  const renderEndCard = () => {
    if (!book) return;
    const bookEnd = spineIndex === lastSpine();
    const theme = THEME_COLORS[settings.theme];
    endEl.style.background = theme.background || '#fff';
    endEl.style.color = theme.color || '#111';
    endEl.replaceChildren();

    const title = doc.createElement('div');
    title.style.cssText = 'font-size:1.4rem;font-weight:700;';
    title.textContent = bookEnd ? 'The End' : `End of ${chapterLabel(spineIndex)}`;
    const sub = doc.createElement('div');
    sub.style.cssText = 'opacity:.7;font-size:.95rem;';
    sub.textContent = bookEnd ? book.metadata.title : 'Next: ' + chapterLabel(spineIndex + 1);
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;';

    const btn = (text: string, onClick: () => void) => {
      const b = doc.createElement('button');
      b.textContent = text;
      b.style.cssText =
        'font:inherit;padding:.4rem .9rem;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;';
      b.addEventListener('click', onClick);
      return b;
    };
    if (bookEnd) {
      row.append(
        btn('Restart', () => goto(0)),
        btn('Contents', () => emitter.emit('reader:endpage', endPagePayload(true))),
      );
    } else {
      row.append(btn('Continue →', () => turn('forward')));
    }
    endEl.append(title, sub, row);
  };

  const endPagePayload = (visible: boolean) => ({
    visible,
    kind: (spineIndex === lastSpine() ? 'book' : 'chapter') as 'book' | 'chapter',
    label: spineIndex === lastSpine() ? 'The End' : `End of ${chapterLabel(spineIndex)}`,
    hasNext: spineIndex < lastSpine(),
  });

  let endVisible = false;
  const renderView = () => {
    const showing = onEndSlot();
    if (showing) {
      renderEndCard();
      endEl.style.display = 'flex';
      frame.style.visibility = 'hidden';
    } else {
      endEl.style.display = 'none';
      frame.style.visibility = 'visible';
      applyPage();
    }
    if (showing !== endVisible) {
      endVisible = showing;
      emitter.emit('reader:endpage', endPagePayload(showing));
    }
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
    page = Math.min(page, maxPage());
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
      dimImages: settings.dimImages && THEME_COLORS[settings.theme].dark,
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
    const { html, urls } = rewriteResources(source_, book, item.href, parser, {
      stripAuthorCss: !settings.publisherStyles,
    });
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
        renderView();
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

  let chromeVisible = settings.menuPosition === 'top';
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

  const centerToggleOnSingleClick = () =>
    settings.menuPosition === 'top' || settings.menuReveal === 'click';

  const onClick = (ev: MouseEvent) => {
    if ((ev.target as Element | null)?.closest?.('a, button')) return;
    const rect = root.getBoundingClientRect();
    const r = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0.5;
    const rtl = book?.metadata.direction === 'rtl';
    if (r < 1 / 3) turn(rtl ? 'forward' : 'back');
    else if (r > 2 / 3) turn(rtl ? 'back' : 'forward');
    else if (centerToggleOnSingleClick()) toggleChrome();
  };

  const onDblClick = (ev: MouseEvent) => {
    if ((ev.target as Element | null)?.closest?.('a, button')) return;
    if (centerToggleOnSingleClick()) return;
    const rect = root.getBoundingClientRect();
    const r = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0.5;
    if (r >= 1 / 3 && r <= 2 / 3) toggleChrome();
  };

  /** Wire keyboard/wheel/click on the iframe doc (events don't bubble to the parent). */
  const wireInput = () => {
    const cdoc = frame.contentDocument;
    if (!cdoc) return;
    cdoc.addEventListener('keydown', onKey);
    cdoc.addEventListener('wheel', onWheel, { passive: false });
    cdoc.addEventListener('click', onClick);
    cdoc.addEventListener('dblclick', onDblClick);
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
    if (next >= 0 && next <= maxPage()) {
      page = next;
      renderView();
      emitLocation();
      return;
    }
    if (next < 0) {
      if (spineIndex === 0) emitter.emit('reader:start', {});
      else void renderSpine(spineIndex - 1, true);
      return;
    }
    // past the end slot
    if (spineIndex === lastSpine()) emitter.emit('reader:end', {});
    else void renderSpine(spineIndex + 1, false);
  }

  function goto(target: number | Position): void {
    if (!book) return;
    if (typeof target === 'object') {
      if (target.type === 'anchor') {
        const idx = Math.min(target.spine, book.spine.length - 1);
        pendingAnchor = target;
        if (idx === spineIndex) {
          resolvePendingAnchor();
          renderView();
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
      const eff = effectivePages(i);
      if (target < acc + eff || i === lastSpine()) {
        const localPage = Math.max(0, target - acc);
        const land = () => {
          page = Math.min(localPage, maxPage());
          renderView();
          emitLocation();
        };
        if (i === spineIndex) land();
        else void renderSpine(i).then(land);
        return;
      }
      acc += eff;
    }
  }

  /** Reflow (resize / restyle) keeping the reader at the same fraction of the spine. */
  const reflowKeepingPlace = () => {
    const wasEnd = onEndSlot();
    const frac = spinePageCount > 0 ? page / spinePageCount : 0;
    injectStyle();
    measure();
    page = wasEnd
      ? spinePageCount
      : Math.min(Math.max(Math.round(frac * spinePageCount), 0), Math.max(0, spinePageCount - 1));
    renderView();
    emitLocation();
  };

  function setSettings(patch: Partial<TextEngineSettings>): void {
    const prev = settings;
    settings = { ...settings, ...patch };
    if (settings.menuPosition !== prev.menuPosition) {
      chromeVisible = settings.menuPosition === 'top';
      emitter.emit('reader:chrometoggle', { visible: chromeVisible });
    }
    if (settings.publisherStyles !== prev.publisherStyles) {
      // author CSS is baked in at render time — re-render the spine
      void renderSpine(spineIndex);
    } else {
      reflowKeepingPlace();
    }
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
    root.addEventListener('dblclick', onDblClick);
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
    emitter.emit('reader:chrometoggle', { visible: chromeVisible });
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
    root.removeEventListener('dblclick', onDblClick);
    resizeObserver?.disconnect();
    revokeUrls();
    search.destroy();
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
    chapters: engineChapters,
    search: runSearch,
    gotoHit,
  };
}
