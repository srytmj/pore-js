import type { ImageEngineSettings } from '../settings/types.js';
import type { ImagePage } from '../source/types.js';
import type { PageLoader } from './page-loader.js';

export type PreloadSettings = Pick<
  ImageEngineSettings,
  'preload' | 'preloadStrategy' | 'preloadAhead' | 'preloadBehind' | 'preloadAllMaxMB'
>;

export interface PrefetchOptions {
  loader: PageLoader;
  pages: ImagePage[];
  chapters?: { startIndex: number }[];
  settings: PreloadSettings;
  concurrency?: number;
  /** Fires when 'all' is refused/aborted by the byte guard (→ fall back to window). */
  onCapped?: (reason: 'estimate' | 'runtime') => void;
}

const BYTES_PER_MB = 1024 * 1024;
/** Fallback per-page estimate when the manifest carries no dimensions. */
const ASSUMED_BYTES_PER_PAGE = 600 * 1024;

/** Rough decoded-agnostic byte estimate from pixel area (~0.5 B/px compressed). */
function estimateBytes(page: ImagePage | undefined): number {
  if (page && typeof page.width === 'number' && typeof page.height === 'number') {
    return Math.round(page.width * page.height * 0.5);
  }
  return ASSUMED_BYTES_PER_PAGE;
}

/**
 * Drives speculative page loading for the image engine.
 * `window` = ring buffer around the current page.
 * `all` = whole chapter, active→end→start, capped by `preloadAllMaxMB`.
 */
export class PrefetchScheduler {
  #opts: PrefetchOptions;
  #settings: PreloadSettings;
  #concurrency: number;
  #inFlight = 0;
  #queue: number[] = [];
  #allActiveForChapter: number | null = null;
  #cappedForChapter = new Set<number>();
  #runningBytes = 0;
  #destroyed = false;

  constructor(opts: PrefetchOptions) {
    this.#opts = opts;
    this.#settings = opts.settings;
    this.#concurrency = opts.concurrency ?? 6;
  }

  setSettings(patch: PreloadSettings): void {
    this.#settings = patch;
  }

  /** Chapter [start, end] (inclusive) that contains `page`. */
  #chapterRange(page: number): [number, number] {
    const last = this.#opts.pages.length - 1;
    const chapters = this.#opts.chapters;
    if (!chapters?.length) return [0, last];
    let start = 0;
    let end = last;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i]!.startIndex <= page) {
        start = chapters[i]!.startIndex;
        end = i + 1 < chapters.length ? chapters[i + 1]!.startIndex - 1 : last;
      }
    }
    return [start, end];
  }

  /** Called on every location change with the current leading page. */
  update(currentPage: number): void {
    if (this.#destroyed || !this.#settings.preload) return;

    if (this.#settings.preloadStrategy === 'all') {
      this.#planAll(currentPage);
    } else {
      this.#planWindow(currentPage);
    }
    this.#pump();
  }

  #planWindow(current: number): void {
    this.#queue = [];
    this.#allActiveForChapter = null;
    const last = this.#opts.pages.length - 1;
    const { preloadAhead, preloadBehind } = this.#settings;
    const order: number[] = [];
    for (let d = 0; d <= preloadAhead; d++) order.push(current + d);
    for (let d = 1; d <= preloadBehind; d++) order.push(current - d);
    this.#queue = order.filter((i) => i >= 0 && i <= last && !this.#opts.loader.isLoaded(i));
  }

  #planAll(current: number): void {
    const [start, end] = this.#chapterRange(current);
    const chapterKey = start;

    if (this.#cappedForChapter.has(chapterKey)) {
      this.#planWindow(current);
      return;
    }

    if (this.#allActiveForChapter !== chapterKey) {
      // new chapter (or first run): re-arm and reset the running total
      this.#allActiveForChapter = chapterKey;
      this.#runningBytes = 0;

      const estimate = this.#opts.pages
        .slice(start, end + 1)
        .reduce((sum, p) => sum + estimateBytes(p), 0);
      if (estimate > this.#settings.preloadAllMaxMB * BYTES_PER_MB) {
        this.#cappedForChapter.add(chapterKey);
        this.#opts.onCapped?.('estimate');
        this.#planWindow(current);
        return;
      }
    }

    const order: number[] = [];
    for (let i = current; i <= end; i++) order.push(i);
    for (let i = current - 1; i >= start; i--) order.push(i);
    this.#queue = order.filter((i) => !this.#opts.loader.isLoaded(i));
  }

  #pump(): void {
    while (!this.#destroyed && this.#inFlight < this.#concurrency && this.#queue.length > 0) {
      const index = this.#queue.shift()!;
      if (this.#opts.loader.isLoaded(index)) continue;

      this.#inFlight++;
      void this.#opts.loader
        .get(index)
        .then(() => {
          if (this.#allActiveForChapter !== null) {
            this.#runningBytes += this.#opts.loader.bytesOf(index);
            if (this.#runningBytes > this.#settings.preloadAllMaxMB * BYTES_PER_MB) {
              this.#cappedForChapter.add(this.#allActiveForChapter);
              this.#allActiveForChapter = null;
              this.#queue = [];
              this.#opts.onCapped?.('runtime');
            }
          }
        })
        .catch(() => {
          /* surfaced via loader onState('error') */
        })
        .finally(() => {
          this.#inFlight--;
          this.#pump();
        });
    }
  }

  destroy(): void {
    this.#destroyed = true;
    this.#queue = [];
  }
}
