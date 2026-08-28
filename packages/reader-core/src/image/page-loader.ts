import type { ReaderSource, Variant } from '../source/types.js';
import type { PageLoadState } from './types.js';

export interface PageLoaderOptions {
  source: ReaderSource;
  bookId: string;
  variant?: Variant;
  /** 'native' can use a source-provided URL directly; others go via object URL. */
  loadingMethod: 'native' | 'blob' | 'bitmap';
  /** How many loaded-but-unretained pages to keep before revoking (back-nav LRU). */
  keepExtra?: number;
  onState?: (index: number, state: PageLoadState) => void;
  /** Fired once per page when its bytes are known (object-URL path only). */
  onBytes?: (index: number, bytes: number) => void;
}

interface Entry {
  state: PageLoadState;
  url: string | undefined;
  objectUrl: boolean;
  bytes: number;
  promise: Promise<string> | undefined;
  controller: AbortController | undefined;
}

/**
 * Loads page images and hands back a URL usable as an `<img>` src.
 * Cache + retain-set eviction (with a small back-nav LRU) + abort.
 * Prefetch policy (ring buffer / whole-chapter) lives in {@link PrefetchScheduler}.
 */
export class PageLoader {
  readonly #opts: PageLoaderOptions;
  readonly #entries = new Map<number, Entry>();
  #retained = new Set<number>();
  /** loaded entries outside the retain set, oldest first */
  #lru: number[] = [];

  constructor(opts: PageLoaderOptions) {
    this.#opts = opts;
  }

  state(index: number): PageLoadState {
    return this.#entries.get(index)?.state ?? 'idle';
  }

  bytesOf(index: number): number {
    return this.#entries.get(index)?.bytes ?? 0;
  }

  isLoaded(index: number): boolean {
    return this.#entries.get(index)?.state === 'loaded';
  }

  get(index: number): Promise<string> {
    const existing = this.#entries.get(index);
    if (existing?.url) return Promise.resolve(existing.url);
    if (existing?.promise) return existing.promise;

    const controller = new AbortController();
    const entry: Entry = {
      state: 'loading',
      url: undefined,
      objectUrl: false,
      bytes: 0,
      promise: undefined,
      controller,
    };
    this.#entries.set(index, entry);
    this.#emit(index, 'loading');

    entry.promise = this.#fetch(index, controller.signal)
      .then(({ url, objectUrl, bytes }) => {
        entry.url = url;
        entry.objectUrl = objectUrl;
        entry.bytes = bytes;
        entry.state = 'loaded';
        entry.promise = undefined;
        entry.controller = undefined;
        this.#emit(index, 'loaded');
        if (bytes > 0) this.#opts.onBytes?.(index, bytes);
        if (!this.#retained.has(index)) this.#touchLru(index);
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
   * Declare the pages worth keeping. In-flight loads outside the set are
   * aborted; loaded pages outside the set stay until the LRU overflows.
   */
  retain(indices: Iterable<number>): void {
    this.#retained = new Set(indices);
    this.#lru = this.#lru.filter((i) => !this.#retained.has(i));

    for (const [index, entry] of this.#entries) {
      if (this.#retained.has(index)) continue;
      if (entry.state === 'loading') {
        entry.controller?.abort();
        this.#drop(index);
      } else if (entry.state === 'loaded' && !this.#lru.includes(index)) {
        this.#touchLru(index);
      } else if (entry.state === 'error') {
        this.#drop(index);
      }
    }
    this.#trimLru();
  }

  destroy(): void {
    for (const entry of this.#entries.values()) {
      entry.controller?.abort();
      if (entry.objectUrl && entry.url) URL.revokeObjectURL(entry.url);
    }
    this.#entries.clear();
    this.#retained.clear();
    this.#lru = [];
  }

  #touchLru(index: number): void {
    this.#lru = this.#lru.filter((i) => i !== index);
    this.#lru.push(index);
    this.#trimLru();
  }

  #trimLru(): void {
    const cap = this.#opts.keepExtra ?? 12;
    while (this.#lru.length > cap) {
      const victim = this.#lru.shift()!;
      this.#drop(victim);
    }
  }

  #drop(index: number): void {
    const entry = this.#entries.get(index);
    if (!entry) return;
    if (entry.objectUrl && entry.url) URL.revokeObjectURL(entry.url);
    this.#entries.delete(index);
    this.#lru = this.#lru.filter((i) => i !== index);
  }

  async #fetch(
    index: number,
    signal: AbortSignal,
  ): Promise<{ url: string; objectUrl: boolean; bytes: number }> {
    const { source, bookId, variant, loadingMethod } = this.#opts;
    const opts = variant ? { variant, signal } : { signal };
    const result = await source.getPage(bookId, index, opts);
    if (typeof result === 'string') {
      if (loadingMethod === 'native') return { url: result, objectUrl: false, bytes: 0 };
      const res = await fetch(result, { signal });
      if (!res.ok) throw new Error(`page ${index}: HTTP ${res.status}`);
      const blob = await res.blob();
      return { url: URL.createObjectURL(blob), objectUrl: true, bytes: blob.size };
    }
    return { url: URL.createObjectURL(result), objectUrl: true, bytes: result.size };
  }

  #emit(index: number, state: PageLoadState): void {
    this.#opts.onState?.(index, state);
  }
}
