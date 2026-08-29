import { createImageEngine } from '../image/create-image-engine.js';
import type { ImageEngine, ImageEngineOptions } from '../image/engine.js';
import type { ImageEngineEvents } from '../image/types.js';
import type { TocEntry } from '../text/epub/types.js';
import { PdfImageSource, type PdfSourceOptions } from './pdf-source.js';

export interface CreatePdfEngineOptions extends Omit<ImageEngineOptions, 'source'> {
  source: ImageEngineOptions['source'];
  pdf?: PdfSourceOptions;
}

export interface PdfEngineEvents extends ImageEngineEvents {
  'reader:toc': { toc: TocEntry[] };
}

export interface PdfEngine extends Omit<ImageEngine, 'on'> {
  on<E extends keyof PdfEngineEvents>(
    event: E,
    handler: (payload: PdfEngineEvents[E]) => void,
  ): () => void;
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
  let toc: TocEntry[] = [];

  const readyOff = engine.on('reader:ready', () => {
    void pdfSource.outline().then((o) => {
      toc = o;
      for (const l of tocListeners) l({ toc });
    });
  });

  return {
    ...engine,
    on(event, handler) {
      if (event === 'reader:toc') {
        const l = handler as unknown as (p: { toc: TocEntry[] }) => void;
        tocListeners.add(l);
        if (toc.length) l({ toc });
        return () => tocListeners.delete(l);
      }
      return engine.on(
        event as keyof ImageEngineEvents,
        handler as (p: ImageEngineEvents[keyof ImageEngineEvents]) => void,
      );
    },
    destroy() {
      readyOff();
      tocListeners.clear();
      engine.destroy();
      void pdfSource.dispose();
    },
  };
}
