import type { Position } from '../position/types.js';
import type { GetPageOpts, Manifest, ReaderSource } from './types.js';
import { parseImageManifestFile, type ParsedFixtureManifest } from './manifest-file.js';

export interface DemoSourceOptions {
  /** Base URL the bundled fixtures are served from (defaults to "/fixtures"). */
  baseUrl?: string;
  /** Injectable fetch, for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * Serves bundled public-domain / CC fixtures. Powers the public demo and tests.
 *
 * Progress is kept in-memory here; the demo app layers durable storage on top
 * via a `CachedSource` decorator (T7 / spec §2.2.1).
 */
export class DemoSource implements ReaderSource {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #progress = new Map<string, Position>();
  readonly #parsed = new Map<string, ParsedFixtureManifest>();

  constructor(opts: DemoSourceOptions = {}) {
    this.#baseUrl = (opts.baseUrl ?? '/fixtures').replace(/\/$/, '');
    const f = opts.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new Error('DemoSource: no fetch available; pass opts.fetch');
    }
    this.#fetch = f.bind(globalThis);
  }

  async getManifest(bookId: string): Promise<Manifest> {
    return (await this.#load(bookId)).manifest;
  }

  async getPage(bookId: string, index: number, opts?: GetPageOpts): Promise<Blob> {
    const { pageUrls } = await this.#load(bookId);
    const url = pageUrls[index];
    if (url === undefined) {
      throw new RangeError(`DemoSource: page ${index} out of range for "${bookId}"`);
    }
    const res = await this.#fetch(url, opts?.signal ? { signal: opts.signal } : undefined);
    if (!res.ok) throw new Error(`DemoSource: page ${index} of "${bookId}" → HTTP ${res.status}`);
    return res.blob();
  }

  getFile(_bookId: string): Promise<Blob> {
    return Promise.reject(new Error('DemoSource.getFile: not implemented (M1, text formats)'));
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

  async #load(bookId: string): Promise<ParsedFixtureManifest> {
    const cached = this.#parsed.get(bookId);
    if (cached) return cached;

    const manifestUrl = `${this.#baseUrl}/${encodeURIComponent(bookId)}/manifest.json`;
    const res = await this.#fetch(manifestUrl);
    if (!res.ok) {
      throw new Error(`DemoSource: manifest for "${bookId}" → HTTP ${res.status}`);
    }
    const raw: unknown = await res.json();
    const parsed = parseImageManifestFile(raw, { bookId, manifestUrl });
    this.#parsed.set(bookId, parsed);
    return parsed;
  }
}
