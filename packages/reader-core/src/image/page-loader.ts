import type { ReaderSource, Variant } from '../source/types.js';
import type { PageLoadState } from './types.js';

export interface PageLoaderOptions {
  source: ReaderSource;
  bookId: string;
  variant?: Variant;
  /** 'native' can use a source-provided URL directly; others go via object URL. */
  loadingMethod: 'native' | 'blob' | 'bitmap';
  onState?: (index: number, state: PageLoadState) => void;
}

interface Entry {
  state: PageLoadState;
  url: string | undefined;
  objectUrl: boolean;
  promise: Promise<string> | undefined;
  controller: AbortController | undefined;
}

/**
 * Loads page images and hands back a URL usable as an `<img>` src.
 * T2: cache + retain-set eviction + abort. T3 layers prefetch policy
 * (ring buffer / whole-chapter) on top of this.
 */
export class PageLoader {
  readonly #opts: PageLoaderOptions;
  readonly #entries = new Map<number, Entry>();
  #retained = new Set<number>();

  constructor(opts: PageLoaderOptions) {
    this.#opts = opts;
  }

  state(index: number): PageLoadState {
    return this.#entries.get(index)?.state ?? 'idle';
  }

  /** Load (or return cached) the image URL for a page. */
  get(index: number): Promise<string> {
    const existing = this.#entries.get(index);
    if (existing?.url) return Promise.resolve(existing.url);
    if (existing?.promise) return existing.promise;

    const controller = new AbortController();
    const entry: Entry = {
      state: 'loading',
      url: undefined,
      objectUrl: false,
      promise: undefined,
      controller,
    };
    this.#entries.set(index, entry);
    this.#emit(index, 'loading');

    entry.promise = this.#fetch(index, controller.signal)
      .then(({ url, objectUrl }) => {
        entry.url = url;
        entry.objectUrl = objectUrl;
        entry.state = 'loaded';
        entry.promise = undefined;
        entry.controller = undefined;
        this.#emit(index, 'loaded');
        return url;
      })
      .catch((err: unknown) => {
        entry.state = 'error';
        entry.promise = undefined;
        entry.controller = undefined;
        this.#emit(index, 'error');
        throw err;
      });
    return entry.promise;
  }

  /**
   * Declare the set of pages worth keeping. In-flight loads outside the set are
   * aborted; decoded object URLs outside the set are revoked.
   */
  retain(indices: Iterable<number>): void {
    this.#retained = new Set(indices);
    for (const [index, entry] of this.#entries) {
      if (this.#retained.has(index)) continue;
      if (entry.state === 'loading') entry.controller?.abort();
      if (entry.objectUrl && entry.url) URL.revokeObjectURL(entry.url);
      this.#entries.delete(index);
    }
  }

  destroy(): void {
    for (const entry of this.#entries.values()) {
      entry.controller?.abort();
      if (entry.objectUrl && entry.url) URL.revokeObjectURL(entry.url);
    }
    this.#entries.clear();
    this.#retained.clear();
  }

  async #fetch(index: number, signal: AbortSignal): Promise<{ url: string; objectUrl: boolean }> {
    const { source, bookId, variant, loadingMethod } = this.#opts;
    const opts = variant ? { variant, signal } : { signal };
    const result = await source.getPage(bookId, index, opts);
    if (typeof result === 'string') {
      if (loadingMethod === 'native') return { url: result, objectUrl: false };
      const res = await fetch(result, { signal });
      if (!res.ok) throw new Error(`page ${index}: HTTP ${res.status}`);
      return { url: URL.createObjectURL(await res.blob()), objectUrl: true };
    }
    return { url: URL.createObjectURL(result), objectUrl: true };
  }

  #emit(index: number, state: PageLoadState): void {
    this.#opts.onState?.(index, state);
  }
}
