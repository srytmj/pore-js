import type {
  GetFileOpts,
  GetPageOpts,
  ImageManifest,
  Manifest,
  ReaderSource,
} from '../source/types.js';
import type { Position } from '../position/types.js';
import type { TocEntry } from '../text/epub/types.js';
import { loadPdf, type PdfDoc } from './parse.js';

export interface PdfSourceOptions {
  /** Max rendered page dimension in px (caps memory on huge pages). */
  maxDim?: number;
}

/**
 * Adapts a PDF (fetched via `inner.getFile`) into an `ImageManifest` +
 * canvas-rendered page blobs, so the **image engine** can read it unchanged.
 * Progress passes through to the wrapped source.
 */
export class PdfImageSource implements ReaderSource {
  readonly #inner: ReaderSource;
  readonly #maxDim: number;
  #doc: PdfDoc | null = null;
  #docPromise: Promise<PdfDoc> | null = null;

  constructor(inner: ReaderSource, opts: PdfSourceOptions = {}) {
    this.#inner = inner;
    this.#maxDim = opts.maxDim ?? 2400;
  }

  /** Flattened outline for the shell's `reader:toc`. */
  async outline(): Promise<TocEntry[]> {
    return (await this.#load()).outline;
  }

  async getManifest(bookId: string): Promise<Manifest> {
    const doc = await this.#load(bookId);
    const sizes = await Promise.all(
      Array.from({ length: doc.pageCount }, (_, i) => doc.pageSize(i + 1)),
    );
    const chapters = outlineToChapters(doc.outline);
    const manifest: ImageManifest = {
      bookId,
      type: 'image',
      title: bookId,
      direction: 'ltr',
      pageCount: doc.pageCount,
      pages: sizes.map((s, index) => ({ index, width: s.width, height: s.height })),
      preferredLayout: 'paged-single',
      ...(chapters.length ? { chapters } : {}),
    };
    return manifest;
  }

  async getPage(bookId: string, index: number, opts?: GetPageOpts): Promise<Blob> {
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const doc = await this.#load(bookId);
    return doc.renderToBlob(index + 1, { maxDim: this.#maxDim });
  }

  getFile(_bookId: string, _opts?: GetFileOpts): Promise<Blob> {
    return Promise.reject(new Error('PdfImageSource: pages only'));
  }

  loadProgress(bookId: string): Promise<Position | null> {
    return this.#inner.loadProgress(bookId);
  }

  saveProgress(bookId: string, p: Position): Promise<void> {
    return this.#inner.saveProgress(bookId, p);
  }

  async dispose(): Promise<void> {
    await this.#doc?.destroy();
    this.#doc = null;
    this.#docPromise = null;
  }

  #load(bookId?: string): Promise<PdfDoc> {
    if (this.#doc) return Promise.resolve(this.#doc);
    this.#docPromise ??= (async () => {
      const blob = await this.#inner.getFile(bookId ?? '');
      const doc = await loadPdf(new Uint8Array(await blob.arrayBuffer()));
      this.#doc = doc;
      return doc;
    })();
    return this.#docPromise;
  }
}

/** PDF page number is 1-based; TocEntry hrefs are `#page=N`. */
function outlineToChapters(
  outline: TocEntry[],
): { id: string; label: string; startIndex: number }[] {
  const out: { id: string; label: string; startIndex: number }[] = [];
  const walk = (entries: TocEntry[]) => {
    for (const e of entries) {
      const m = /#page=(\d+)/.exec(e.href);
      if (m) out.push({ id: e.href, label: e.label, startIndex: Number(m[1]) - 1 });
      walk(e.children);
    }
  };
  walk(outline);
  return out.sort((a, b) => a.startIndex - b.startIndex);
}
