import { unzipSync } from 'fflate';
import type { Position } from '../position/types.js';
import type { Direction } from '../types.js';
import type { GetPageOpts, ImageManifest, Manifest, ReaderSource } from './types.js';
import { naturalCompare } from './manifest-file.js';

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;
const ZIP_RE = /\.(cbz|zip)$/i;

export interface LocalFileSourceOptions {
  title?: string;
  direction?: Direction;
}

type Entry = { kind: 'file'; file: File } | { kind: 'zip-entry'; name: string };

/**
 * Reads a book the user dropped in: a `.cbz` / `.zip`, or a set of image files.
 * Progress is in-memory — wrap in `CachedSource` for persistence.
 *
 * ZIP entries are inflated one at a time on `getPage` (the archive bytes are
 * held; only the requested entry is decompressed).
 */
export class LocalFileSource implements ReaderSource {
  readonly #bookId: string;
  readonly #opts: LocalFileSourceOptions;
  #zipBytes: Uint8Array | null = null;
  #entries: Entry[] = [];
  #progress: Position | null = null;
  #ready: Promise<void>;

  constructor(files: File[] | FileList, opts: LocalFileSourceOptions = {}) {
    const list = Array.from(files);
    this.#opts = opts;
    const zip = list.find((f) => ZIP_RE.test(f.name));
    this.#bookId = zip?.name ?? list[0]?.name ?? 'local';
    this.#ready = zip ? this.#initZip(zip) : this.#initImages(list);
  }

  get bookId(): string {
    return this.#bookId;
  }

  async getManifest(_bookId: string): Promise<Manifest> {
    await this.#ready;
    const manifest: ImageManifest = {
      bookId: this.#bookId,
      type: 'image',
      title: this.#opts.title ?? this.#bookId.replace(/\.(cbz|zip)$/i, ''),
      direction: this.#opts.direction ?? 'ltr',
      pageCount: this.#entries.length,
      pages: this.#entries.map((_, index) => ({ index })),
    };
    return manifest;
  }

  async getPage(_bookId: string, index: number, opts?: GetPageOpts): Promise<Blob> {
    await this.#ready;
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const entry = this.#entries[index];
    if (!entry) throw new RangeError(`LocalFileSource: page ${index} out of range`);
    if (entry.kind === 'file') return entry.file;

    const bytes = this.#zipBytes;
    if (!bytes) throw new Error('LocalFileSource: archive not loaded');
    const out = unzipSync(bytes, { filter: (f) => f.name === entry.name });
    const data = out[entry.name];
    if (!data) throw new Error(`LocalFileSource: entry "${entry.name}" not found`);
    return new Blob([data], { type: mimeFor(entry.name) });
  }

  getFile(): Promise<Blob> {
    return Promise.reject(new Error('LocalFileSource.getFile: image books only'));
  }

  loadProgress(): Promise<Position | null> {
    return Promise.resolve(this.#progress);
  }

  saveProgress(_bookId: string, p: Position): Promise<void> {
    this.#progress = p;
    return Promise.resolve();
  }

  async #initZip(file: File): Promise<void> {
    this.#zipBytes = new Uint8Array(await file.arrayBuffer());
    // list entries by decompressing nothing (filter rejects all)
    const names: string[] = [];
    unzipSync(this.#zipBytes, {
      filter: (f) => {
        if (IMAGE_RE.test(f.name) && !f.name.startsWith('__MACOSX/')) names.push(f.name);
        return false;
      },
    });
    names.sort(naturalCompare);
    this.#entries = names.map((name) => ({ kind: 'zip-entry', name }));
  }

  #initImages(list: File[]): Promise<void> {
    this.#entries = list
      .filter((f) => IMAGE_RE.test(f.name))
      .sort((a, b) => naturalCompare(a.name, b.name))
      .map((file) => ({ kind: 'file', file }));
    return Promise.resolve();
  }
}

function mimeFor(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  return ext === 'png'
    ? 'image/png'
    : ext === 'webp'
      ? 'image/webp'
      : ext === 'gif'
        ? 'image/gif'
        : ext === 'avif'
          ? 'image/avif'
          : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/jpeg';
}
