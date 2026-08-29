import type { Chapter } from './reader-engine.js';

/**
 * Exponential moving average of wall-clock seconds spent per page, used for the
 * shell's "N min left" estimate. Seeded per format (manga turns fast, prose
 * slow) and nudged toward the reader's actual pace as they turn pages.
 */
export class PaceEstimator {
  #secondsPerPage: number;
  #last = 0;

  constructor(seedSecondsPerPage: number) {
    this.#secondsPerPage = seedSecondsPerPage;
  }

  /** Call once per settled page change. Dwell times outside 1–120s are ignored. */
  mark(now: number = Date.now()): void {
    if (this.#last) {
      const dt = (now - this.#last) / 1000;
      if (dt >= 1 && dt <= 120) {
        this.#secondsPerPage = this.#secondsPerPage * 0.75 + dt * 0.25;
      }
    }
    this.#last = now;
  }

  get secondsPerPage(): number {
    return this.#secondsPerPage;
  }

  minutesLeft(pagesLeft: number): number {
    return Math.max(0, Math.round((pagesLeft * this.#secondsPerPage) / 60));
  }
}

/**
 * Given the book's chapter list and the current book-level page, work out which
 * chapter we're in and how many pages remain before the next one.
 */
export function chapterProgress(
  chapters: Chapter[],
  page: number,
  total: number,
): { index: number; label: string; pagesLeftInChapter: number } {
  if (chapters.length === 0) {
    return { index: 0, label: '', pagesLeftInChapter: Math.max(0, total - 1 - page) };
  }
  let index = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i]!.startPage <= page) index = i;
  }
  const next = chapters[index + 1];
  const endPage = next ? next.startPage : total;
  return {
    index,
    label: chapters[index]!.label,
    pagesLeftInChapter: Math.max(0, endPage - 1 - page),
  };
}
