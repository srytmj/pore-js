import type { Position } from '../position/types.js';
import type { GetFileOpts, GetPageOpts, Manifest, ReaderSource } from './types.js';
import { openKvStore, type KvStore } from '../offline/idb.js';

export interface CachedSourceOptions {
  /** Storage backend; defaults to an IndexedDB-backed KV store. */
  store?: KvStore;
  /** Namespace for keys (lets multiple libraries coexist). Default "pore". */
  namespace?: string;
}

interface QueuedWrite {
  bookId: string;
  position: Position;
  at: number;
}

/**
 * Wraps any {@link ReaderSource}, persisting reading progress locally so a
 * checkpoint survives reloads and works offline. Manifest/page/file calls pass
 * straight through. See docs/image-engine-spec.md §2.2.1.
 *
 * Progress writes are mirrored to the wrapped source (best-effort). If that
 * write fails (offline), it is queued and flushed on the next `online` event.
 */
export class CachedSource implements ReaderSource {
  readonly #inner: ReaderSource;
  readonly #store: KvStore;
  readonly #ns: string;
  #queue: QueuedWrite[] = [];
  #flushing = false;
  readonly #onOnline = () => void this.flush();

  constructor(inner: ReaderSource, opts: CachedSourceOptions = {}) {
    this.#inner = inner;
    this.#store = opts.store ?? openKvStore();
    this.#ns = opts.namespace ?? 'pore';
    if (typeof addEventListener === 'function') addEventListener('online', this.#onOnline);
  }

  getManifest(bookId: string): Promise<Manifest> {
    return this.#inner.getManifest(bookId);
  }

  getPage(bookId: string, index: number, opts?: GetPageOpts): Promise<Blob | string> {
    return this.#inner.getPage(bookId, index, opts);
  }

  getFile(bookId: string, opts?: GetFileOpts): Promise<Blob> {
    return this.#inner.getFile(bookId, opts);
  }

  /** Local copy wins; falls back to the wrapped source if we have nothing. */
  async loadProgress(bookId: string): Promise<Position | null> {
    const local = await this.#store.get<Position>(this.#key(bookId));
    if (local) return local;
    try {
      return await this.#inner.loadProgress(bookId);
    } catch {
      return null;
    }
  }

  async saveProgress(bookId: string, p: Position): Promise<void> {
    await this.#store.set(this.#key(bookId), p);
    try {
      await this.#inner.saveProgress(bookId, p);
    } catch {
      this.#enqueue({ bookId, position: p, at: Date.now() });
    }
  }

  /** Push any queued offline writes to the wrapped source. */
  async flush(): Promise<void> {
    if (this.#flushing || this.#queue.length === 0) return;
    this.#flushing = true;
    // keep only the latest write per book
    const latest = new Map<string, QueuedWrite>();
    for (const w of this.#queue) latest.set(w.bookId, w);
    this.#queue = [];
    try {
      for (const w of latest.values()) {
        try {
          await this.#inner.saveProgress(w.bookId, w.position);
        } catch {
          this.#queue.push(w);
        }
      }
    } finally {
      this.#flushing = false;
    }
  }

  get pendingWrites(): number {
    return this.#queue.length;
  }

  dispose(): void {
    if (typeof removeEventListener === 'function') removeEventListener('online', this.#onOnline);
  }

  #enqueue(w: QueuedWrite): void {
    this.#queue = this.#queue.filter((q) => q.bookId !== w.bookId);
    this.#queue.push(w);
  }

  #key(bookId: string): string {
    return `${this.#ns}:progress:${bookId}`;
  }
}
