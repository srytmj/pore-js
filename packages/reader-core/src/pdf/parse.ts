import type * as Pdfjs from 'pdfjs-dist';
import type { TocEntry } from '../text/epub/types.js';

type PdfjsModule = typeof Pdfjs;
type PdfDocumentProxy = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;

let modPromise: Promise<PdfjsModule> | null = null;
function pdfjs(): Promise<PdfjsModule> {
  // the legacy build runs in Node and older browsers alike
  modPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfjsModule>;
  return modPromise;
}

export interface PdfDoc {
  pageCount: number;
  /** Bookmarks resolved to page numbers (1-based). */
  outline: TocEntry[];
  pageSize(n: number): Promise<{ width: number; height: number }>;
  /**
   * Render page `n` (1-based) to an image the image engine can consume.
   * Browser only (needs a canvas).
   */
  renderToBlob(n: number, opts?: { scale?: number; maxDim?: number }): Promise<Blob>;
  textContent(n: number): Promise<string>;
  destroy(): Promise<void>;
}

export async function loadPdf(data: Uint8Array): Promise<PdfDoc> {
  const { getDocument } = await pdfjs();
  const task = getDocument({ data, isEvalSupported: false } as Parameters<typeof getDocument>[0]);
  const doc: PdfDocumentProxy = await task.promise;
  const outline = await buildOutline(doc);

  return {
    pageCount: doc.numPages,
    outline,

    async pageSize(n) {
      const v = (await doc.getPage(n)).getViewport({ scale: 1 });
      return { width: v.width, height: v.height };
    },

    async renderToBlob(n, o = {}) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = o.scale ?? (globalThis.devicePixelRatio || 1.5);
      if (o.maxDim) scale = Math.min(scale, o.maxDim / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const w = Math.ceil(viewport.width);
      const h = Math.ceil(viewport.height);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('pdf: no 2d context');
      await page.render({
        canvasContext: ctx as unknown as never,
        viewport,
        canvas: canvas as unknown as never,
      }).promise;
      return canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
    },

    async textContent(n) {
      const tc = await (await doc.getPage(n)).getTextContent();
      return tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    async destroy() {
      await task.destroy();
    },
  };
}

interface RawOutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items: RawOutlineNode[];
}

async function buildOutline(doc: PdfDocumentProxy): Promise<TocEntry[]> {
  const raw = (await doc.getOutline()) as RawOutlineNode[] | null;
  if (!raw) return [];

  const resolve = async (node: RawOutlineNode): Promise<TocEntry> => {
    let href = '';
    try {
      const dest = typeof node.dest === 'string' ? await doc.getDestination(node.dest) : node.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (ref) href = `#page=${(await doc.getPageIndex(ref as never)) + 1}`;
    } catch {
      /* unresolvable bookmark — leave href empty */
    }
    return {
      label: node.title,
      href,
      children: await Promise.all((node.items ?? []).map(resolve)),
    };
  };

  return Promise.all(raw.map(resolve));
}
