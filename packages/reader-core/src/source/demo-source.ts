import type { Position } from '../position/types.js';
import type { GetFileOpts, GetPageOpts, Manifest, TextManifest } from './types.js';
import type { ReaderSource } from './types.js';
import { parseImageManifestFile, type ParsedFixtureManifest } from './manifest-file.js';

export interface DemoSourceOptions {
  /** Base URL the bundled fixtures are served from (defaults to "/fixtures"). */
  baseUrl?: string;
  /** Injectable fetch, for tests. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

interface TextFixture {
  kind: 'text';
  manifest: TextManifest;
  fileUrl: string;
}
type Loaded = ({ kind: 'image' } & ParsedFixtureManifest) | TextFixture;

/**
 * Serves bundled public-domain / CC fixtures. Powers the public demo and tests.
 *
 * A fixture's `manifest.json` is an image manifest by default; if it has
 * `"type": "epub"` and a `"file"` it is served as a text book.
 *
 * Progress is kept in-memory here; the demo layers durable storage on top via
 * a `CachedSource` decorator.
 */
export class DemoSource implements ReaderSource {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #progress = new Map<string, Position>();
  readonly #loaded = new Map<string, Loaded>();

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
    const loaded = await this.#load(bookId);
    if (loaded.kind !== 'image') {
      throw new Error(`DemoSource: "${bookId}" is a text book, use getFile`);
    }
    const url = loaded.pageUrls[index];
    if (url === undefined) {
      throw new RangeError(`DemoSource: page ${index} out of range for "${bookId}"`);
    }
    const res = await this.#fetch(url, opts?.signal ? { signal: opts.signal } : undefined);
    if (!res.ok) throw new Error(`DemoSource: page ${index} of "${bookId}" → HTTP ${res.status}`);
    return res.blob();
  }

  async getFile(bookId: string, opts?: GetFileOpts): Promise<Blob> {
    const loaded = await this.#load(bookId);
    if (loaded.kind !== 'text') {
      throw new Error(`DemoSource: "${bookId}" is an image book, use getPage`);
    }
    const res = await this.#fetch(
      loaded.fileUrl,
      opts?.signal ? { signal: opts.signal } : undefined,
    );
    if (!res.ok) throw new Error(`DemoSource: file for "${bookId}" → HTTP ${res.status}`);
    return res.blob();
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

  async #load(bookId: string): Promise<Loaded> {
    const cached = this.#loaded.get(bookId);
    if (cached) return cached;

    const dir = `${this.#baseUrl}/${encodeURIComponent(bookId)}`;
    const manifestUrl = `${dir}/manifest.json`;
    const res = await this.#fetch(manifestUrl);
    if (!res.ok) {
      throw new Error(`DemoSource: manifest for "${bookId}" → HTTP ${res.status}`);
    }
    const raw = (await res.json()) as { type?: string; file?: string; title?: string };

    let loaded: Loaded;
    if ((raw.type === 'epub' || raw.type === 'pdf') && raw.file) {
      loaded = {
        kind: 'text',
        manifest: { bookId, type: raw.type, title: raw.title ?? bookId },
        fileUrl: `${dir}/${raw.file}`,
      };
    } else {
      loaded = { kind: 'image', ...parseImageManifestFile(raw, { bookId, manifestUrl }) };
    }
    this.#loaded.set(bookId, loaded);
    return loaded;
  }
}
