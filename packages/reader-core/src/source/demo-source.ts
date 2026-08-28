import type { Position } from '../position/types.js';
import type { GetPageOpts, Manifest, ReaderSource } from './types.js';

export interface DemoSourceOptions {
  /** Base URL the bundled fixtures are served from (defaults to "/fixtures"). */
  baseUrl?: string;
}

/**
 * Serves bundled public-domain fixtures. Powers the public demo and tests.
 * Progress is kept in-memory here; the demo app layers IndexedDB on top
 * via a CachedSource decorator (M3 / spec §2.2.1).
 *
 * NOTE: skeleton only — fixture wiring lands in M0.
 */
export class DemoSource implements ReaderSource {
  readonly #baseUrl: string;
  readonly #progress = new Map<string, Position>();

  constructor(opts: DemoSourceOptions = {}) {
    this.#baseUrl = opts.baseUrl ?? '/fixtures';
  }

  getManifest(_bookId: string): Promise<Manifest> {
    return Promise.reject(new Error('DemoSource.getManifest: not implemented (M0)'));
  }

  getPage(_bookId: string, _index: number, _opts?: GetPageOpts): Promise<Blob | string> {
    return Promise.reject(new Error('DemoSource.getPage: not implemented (M0)'));
  }

  getFile(_bookId: string): Promise<Blob> {
    return Promise.reject(new Error('DemoSource.getFile: not implemented (M1)'));
  }

  loadProgress(bookId: string): Promise<Position | null> {
    return Promise.resolve(this.#progress.get(bookId) ?? null);
  }

  saveProgress(bookId: string, p: Position): Promise<void> {
    this.#progress.set(bookId, p);
    return Promise.resolve();
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }
}
