import { createImageEngine } from '../image/create-image-engine.js';
import type { ImageEngine, ImageEngineOptions } from '../image/engine.js';
import type { ImageEngineEvents } from '../image/types.js';
import type { TocEntry } from '../text/epub/types.js';
import { SearchController } from '../search/search-controller.js';
import type { SearchHit, SearchSection } from '../search/search-index.js';
import { PdfImageSource, type PdfSourceOptions } from './pdf-source.js';

export interface CreatePdfEngineOptions extends Omit<ImageEngineOptions, 'source'> {
  source: ImageEngineOptions['source'];
  pdf?: PdfSourceOptions;
  /** Passed to the in-book `SearchController`. `false` forces synchronous search. */
  searchWorkerFactory?: (() => Worker) | false;
}

export interface PdfEngineEvents extends ImageEngineEvents {
  'reader:toc': { toc: TocEntry[] };
  'reader:searchresults': { query: string; hits: SearchHit[] };
}

export interface PdfEngine extends Omit<ImageEngine, 'on'> {
  on<E extends keyof PdfEngineEvents>(
    event: E,
    handler: (payload: PdfEngineEvents[E]) => void,
  ): () => void;
  /** Full-text search across the PDF (via pdf.js's per-page text layer). */
  search(query: string): Promise<SearchHit[]>;
  /** Jump to a hit's page. */
  gotoHit(hit: SearchHit): void;
}

/**
 * A PDF reader: the image engine driving pdf.js-rendered pages. Reuses every
 * image behaviour (paged/continuous, zoom/pan, fit, gestures, preload) and adds
 * the document outline as `reader:toc`.
 */
export function createPdfEngine(options: CreatePdfEngineOptions): PdfEngine {
  const pdfSource = new PdfImageSource(options.source, options.pdf);
  const engine = createImageEngine({ ...options, source: pdfSource });

  const tocListeners = new Set<(p: { toc: TocEntry[] }) => void>();
  const searchListeners = new Set<(p: { query: string; hits: SearchHit[] }) => void>();
  let toc: TocEntry[] = [];

  const readyOff = engine.on('reader:ready', () => {
    void pdfSource.outline().then((o) => {
      toc = o;
      for (const l of tocListeners) l({ toc });
    });
  });

  const search = new SearchController(
    options.searchWorkerFactory !== undefined
      ? { workerFactory: options.searchWorkerFactory }
      : {},
  );
  let searchBuilt: Promise<void> | null = null;

  const buildSearch = async (): Promise<void> => {
    const count = await pdfSource.pageCount();
    const sections: SearchSection[] = await Promise.all(
      Array.from({ length: count }, async (_, i) => ({
        id: `page:${i + 1}`,
        index: i,
        text: await pdfSource.textContent(i + 1),
      })),
    );
    await search.build(sections);
  };

  const runSearch = async (query: string): Promise<SearchHit[]> => {
    searchBuilt ??= buildSearch();
    await searchBuilt;
    const hits = await search.query(query, { limit: 300 });
    for (const l of searchListeners) l({ query, hits });
    return hits;
  };

  const gotoHit = (hit: SearchHit): void => engine.goto(hit.sectionIndex);

  return {
    ...engine,
    on(event, handler) {
      if (event === 'reader:toc') {
        const l = handler as unknown as (p: { toc: TocEntry[] }) => void;
        tocListeners.add(l);
        if (toc.length) l({ toc });
        return () => tocListeners.delete(l);
      }
      if (event === 'reader:searchresults') {
        const l = handler as unknown as (p: { query: string; hits: SearchHit[] }) => void;
        searchListeners.add(l);
        return () => searchListeners.delete(l);
      }
      return engine.on(
        event as keyof ImageEngineEvents,
        handler as (p: ImageEngineEvents[keyof ImageEngineEvents]) => void,
      );
    },
    search: runSearch,
    gotoHit,
    destroy() {
      readyOff();
      tocListeners.clear();
      searchListeners.clear();
      search.destroy();
      engine.destroy();
      void pdfSource.dispose();
    },
  };
}
